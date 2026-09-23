import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DiagnosisRead } from '~/types/api'
import { useDiagnoses } from '~/composables/useDiagnoses'
import { deferred } from './deferred'

const MATCHES = [
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' }
]

const STALE: DiagnosisRead[] = [{ code: 'E10.9', description: 'Type 1 diabetes mellitus' }]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useDiagnoses', () => {
  it('exposes the matches on success', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(MATCHES))

    const { results, error, search } = useDiagnoses()
    await search('diab')

    expect(results.value).toEqual(MATCHES)
    expect(error.value).toBeNull()
  })

  it('handles an empty result without erroring', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]))

    const { results, error, search } = useDiagnoses()
    await search('zzz-nothing')

    expect(results.value).toEqual([])
    expect(error.value).toBeNull()
  })

  it('surfaces a backend error instead of swallowing it', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(Object.assign(new Error('fetch failed'), {
      data: { error: { code: 'VALIDATION_ERROR', message: 'Search term must not be empty' } },
      status: 422
    })))

    const { results, error, search } = useDiagnoses()
    await search('diab')

    expect(error.value?.code).toBe('VALIDATION_ERROR')
    expect(error.value?.message).toBe('Search term must not be empty')
    expect(results.value).toEqual([])
  })

  it('surfaces an unreachable backend as NETWORK_ERROR', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const { error, search } = useDiagnoses()
    await search('diab')

    expect(error.value?.code).toBe('NETWORK_ERROR')
  })

  it('does not call the backend for a blank term', async () => {
    const stub = vi.fn()
    vi.stubGlobal('$fetch', stub)

    const { results, search } = useDiagnoses()
    await search('   ')

    expect(stub).not.toHaveBeenCalled()
    expect(results.value).toEqual([])
  })

  it('passes the search term and limit to the endpoint', async () => {
    const stub = vi.fn().mockResolvedValue([])
    vi.stubGlobal('$fetch', stub)

    await useDiagnoses().search('diab', 5)

    const [, options] = stub.mock.calls[0] as [string, { query: Record<string, unknown> }]
    expect(options.query).toEqual({ search: 'diab', limit: 5 })
  })

  it('clears results and error on reset', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(MATCHES))

    const { results, reset, search } = useDiagnoses()
    await search('diab')
    reset()

    expect(results.value).toEqual([])
  })
})

describe('useDiagnoses out-of-order responses', () => {
  it('ignores a stale response that settles after a newer one', async () => {
    const first = deferred<DiagnosisRead[]>()
    const second = deferred<DiagnosisRead[]>()
    vi.stubGlobal('$fetch', vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise))

    const { results, search } = useDiagnoses()
    const slow = search('e1')
    const fast = search('e11')

    second.resolve(MATCHES)
    await fast
    // The stale "e1" response lands last, and must not overwrite "e11"'s matches.
    first.resolve(STALE)
    await slow

    expect(results.value).toEqual(MATCHES)
  })

  it('ignores a stale error that settles after a newer success', async () => {
    const first = deferred<DiagnosisRead[]>()
    const second = deferred<DiagnosisRead[]>()
    vi.stubGlobal('$fetch', vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise))

    const { error, results, search } = useDiagnoses()
    const slow = search('e1')
    const fast = search('e11')

    second.resolve(MATCHES)
    await fast
    first.reject(new Error('ECONNREFUSED'))
    await slow

    expect(error.value).toBeNull()
    expect(results.value).toEqual(MATCHES)
  })

  it('keeps pending true until the latest call settles', async () => {
    const first = deferred<DiagnosisRead[]>()
    const second = deferred<DiagnosisRead[]>()
    vi.stubGlobal('$fetch', vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise))

    const { pending, search } = useDiagnoses()
    const slow = search('e1')
    const fast = search('e11')

    first.resolve(STALE)
    await slow
    expect(pending.value).toBe(true)

    second.resolve(MATCHES)
    await fast
    expect(pending.value).toBe(false)
  })

  it('reset during an in-flight search leaves results empty', async () => {
    const inFlight = deferred<DiagnosisRead[]>()
    vi.stubGlobal('$fetch', vi.fn().mockReturnValue(inFlight.promise))

    const { pending, reset, results, search } = useDiagnoses()
    const pendingSearch = search('diab')
    reset()

    inFlight.resolve(MATCHES)
    await pendingSearch

    expect(results.value).toEqual([])
    expect(pending.value).toBe(false)
  })

  it('a blank term invalidates an in-flight search', async () => {
    const inFlight = deferred<DiagnosisRead[]>()
    vi.stubGlobal('$fetch', vi.fn().mockReturnValue(inFlight.promise))

    const { results, search } = useDiagnoses()
    const pendingSearch = search('diab')
    await search('   ')

    inFlight.resolve(MATCHES)
    await pendingSearch

    expect(results.value).toEqual([])
  })
})
