import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ConsultationRead } from '~/types/api'
import { useConsultations } from '~/composables/useConsultations'
import { deferred } from './deferred'

const CONSULTATION: ConsultationRead = {
  id: 1,
  patient_name: 'Nguyen An',
  notes: 'Routine follow-up',
  created_at: '2026-09-23T07:34:01',
  diagnoses: [{ code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' }]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useConsultations.list', () => {
  it('exposes the rows on success', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([CONSULTATION]))

    const { items, error, list } = useConsultations()
    await list()

    expect(items.value).toEqual([CONSULTATION])
    expect(error.value).toBeNull()
  })

  it('handles an empty list without erroring', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]))

    const { items, error, list } = useConsultations()
    await list({ code: 'Z99.9' })

    expect(items.value).toEqual([])
    expect(error.value).toBeNull()
  })

  it('omits blank filters rather than sending empty query params', async () => {
    const stub = vi.fn().mockResolvedValue([])
    vi.stubGlobal('$fetch', stub)

    await useConsultations().list({ patient: '  ', code: 'I10', limit: 10 })

    const [, options] = stub.mock.calls[0] as [string, { query: Record<string, unknown> }]
    expect(options.query).toEqual({
      patient: undefined,
      code: 'I10',
      limit: 10,
      offset: undefined
    })
  })

  it('surfaces a backend error instead of swallowing it', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(Object.assign(new Error('fetch failed'), {
      data: { error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } },
      status: 422
    })))

    const { error, items, list } = useConsultations()
    await list({ limit: 101 })

    expect(error.value?.code).toBe('VALIDATION_ERROR')
    expect(items.value).toEqual([])
  })
})

describe('useConsultations.list out-of-order responses', () => {
  const OTHER: ConsultationRead = { ...CONSULTATION, id: 2, patient_name: 'Tran Bao' }

  it('ignores a stale response that settles after a newer one', async () => {
    const first = deferred<ConsultationRead[]>()
    const second = deferred<ConsultationRead[]>()
    vi.stubGlobal('$fetch', vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise))

    const { items, list } = useConsultations()
    const slow = list({ patient: 'ngu' })
    const fast = list({ patient: 'nguyen' })

    second.resolve([CONSULTATION])
    await fast
    first.resolve([OTHER])
    await slow

    expect(items.value).toEqual([CONSULTATION])
  })

  it('keeps pending true until the latest call settles', async () => {
    const first = deferred<ConsultationRead[]>()
    const second = deferred<ConsultationRead[]>()
    vi.stubGlobal('$fetch', vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise))

    const { list, pending } = useConsultations()
    const slow = list({ patient: 'ngu' })
    const fast = list({ patient: 'nguyen' })

    first.resolve([OTHER])
    await slow
    expect(pending.value).toBe(true)

    second.resolve([CONSULTATION])
    await fast
    expect(pending.value).toBe(false)
  })
})

describe('useConsultations.create', () => {
  it('returns the created consultation', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(CONSULTATION))

    const created = await useConsultations().create({
      patient_name: 'Nguyen An',
      diagnosis_codes: ['E11.9']
    })

    expect(created).toEqual(CONSULTATION)
  })

  it('posts the payload to the consultations endpoint', async () => {
    const stub = vi.fn().mockResolvedValue(CONSULTATION)
    vi.stubGlobal('$fetch', stub)

    await useConsultations().create({
      patient_name: 'Nguyen An',
      notes: null,
      diagnosis_codes: ['E11.9', 'I10']
    })

    const [url, options] = stub.mock.calls[0] as [string, { method: string, body: unknown }]
    expect(url.endsWith('/consultations')).toBe(true)
    expect(options.method).toBe('POST')
    expect(options.body).toEqual({
      patient_name: 'Nguyen An',
      notes: null,
      diagnosis_codes: ['E11.9', 'I10']
    })
  })

  it('rethrows a backend error so a form can react to the failed submit', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(Object.assign(new Error('fetch failed'), {
      data: { error: { code: 'VALIDATION_ERROR', message: 'Unknown diagnosis code(s): Z99.9' } },
      status: 422
    })))

    const { create, error } = useConsultations()

    await expect(create({ patient_name: 'Nguyen An', diagnosis_codes: ['Z99.9'] }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(error.value?.message).toBe('Unknown diagnosis code(s): Z99.9')
  })

  it('rethrows an unreachable backend as NETWORK_ERROR', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const { create } = useConsultations()

    await expect(create({ patient_name: 'Nguyen An', diagnosis_codes: ['E11.9'] }))
      .rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })
})
