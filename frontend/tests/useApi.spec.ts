import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, useApi } from '~/composables/useApi'

/** Mimics the FetchError $fetch rejects with: parsed body on `data`, plus `status`. */
function fetchError(data: unknown, status: number): Error & { data: unknown, status: number } {
  return Object.assign(new Error('fetch failed'), { data, status })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useApi', () => {
  it('returns the parsed body on success', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([{ code: 'I10', description: 'Hypertension' }]))

    const { request } = useApi()

    await expect(request('/diagnoses')).resolves.toEqual([
      { code: 'I10', description: 'Hypertension' }
    ])
  })

  it('prefixes the configured base url and passes the query through', async () => {
    const stub = vi.fn().mockResolvedValue([])
    vi.stubGlobal('$fetch', stub)

    await useApi().request('/diagnoses', { query: { search: 'diab' } })

    const [url, options] = stub.mock.calls[0] as [string, { query: Record<string, unknown> }]
    expect(url.endsWith('/api/v1/diagnoses')).toBe(true)
    expect(options.query).toEqual({ search: 'diab' })
  })

  it('unwraps an error envelope into an ApiError carrying code and message', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(fetchError(
      { error: { code: 'VALIDATION_ERROR', message: 'Unknown diagnosis code(s): Z99.9' } },
      422
    )))

    await expect(useApi().request('/consultations')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Unknown diagnosis code(s): Z99.9',
      status: 422
    })
  })

  it('keeps the envelope details for field-level errors', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(fetchError(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [{ field: 'body.patient_name', message: 'Value error, must not be blank' }]
        }
      },
      422
    )))

    await expect(useApi().request('/consultations')).rejects.toMatchObject({
      details: [{ field: 'body.patient_name', message: 'Value error, must not be blank' }]
    })
  })

  it('maps an unreachable backend to NETWORK_ERROR instead of leaking the fetch error', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const caught = await useApi().request('/diagnoses').catch((e: unknown) => e)

    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).code).toBe('NETWORK_ERROR')
    expect((caught as ApiError).message).not.toContain('ECONNREFUSED')
  })

  it('maps an unrecognised error body to NETWORK_ERROR rather than trusting it', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(fetchError({ detail: 'Not Found' }, 404)))

    await expect(useApi().request('/nope')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })
})
