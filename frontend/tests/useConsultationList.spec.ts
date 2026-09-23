import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ConsultationRead } from '~/types/api'
import { useConsultationList } from '~/composables/useConsultations'

const CONSULTATION: ConsultationRead = {
  id: 1,
  patient_name: 'Nguyen An',
  notes: 'Routine follow-up',
  created_at: '2026-09-23T07:34:01Z',
  diagnoses: [{ code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' }]
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearNuxtData('consultations-list')
})

describe('useConsultationList', () => {
  it('exposes the rows on success', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([CONSULTATION]))

    const { consultations, error, refresh } = useConsultationList()
    await refresh()

    expect(consultations.value).toEqual([CONSULTATION])
    expect(error.value).toBeNull()
  })

  it('exposes an empty list without erroring', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]))

    const { consultations, error, refresh } = useConsultationList()
    await refresh()

    expect(consultations.value).toEqual([])
    expect(error.value).toBeNull()
  })

  it('surfaces a backend error as plain code/message, not a class instance', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(Object.assign(new Error('fetch failed'), {
      data: { error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } },
      status: 422
    })))

    const { consultations, error, refresh } = useConsultationList()
    await refresh()

    expect(error.value).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: undefined
    })
    // A plain object survives payload serialisation; an ApiError instance would not, so
    // the client would see a different shape from the server.
    expect(Object.getPrototypeOf(error.value!)).toBe(Object.prototype)
    expect(JSON.parse(JSON.stringify(error.value))).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed'
    })
    expect(consultations.value).toEqual([])
  })

  it('surfaces an unreachable backend as NETWORK_ERROR', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const { error, refresh } = useConsultationList()
    await refresh()

    expect(error.value?.code).toBe('NETWORK_ERROR')
    expect(error.value?.message).not.toContain('ECONNREFUSED')
  })

  it('refresh picks up rows added since the first load', async () => {
    // Queue by mutating the stub rather than with mockResolvedValueOnce: useAsyncData
    // fires its own initial fetch, so the number of calls before the refresh is not ours
    // to assume.
    const stub = vi.fn().mockResolvedValue([])
    vi.stubGlobal('$fetch', stub)

    const { consultations, refresh } = useConsultationList()
    await refresh()
    expect(consultations.value).toEqual([])

    stub.mockResolvedValue([CONSULTATION])
    await refresh()

    expect(consultations.value).toEqual([CONSULTATION])
  })
})
