import type { ApiErrorDetail, ApiErrorEnvelope } from '~/types/api'

/**
 * A backend failure, already unwrapped from the error envelope. The UI shows `message`
 * and can branch on `code` (NOT_FOUND, VALIDATION_ERROR, CONFLICT, INTERNAL_ERROR, or
 * NETWORK_ERROR when the request never reached the backend).
 */
export class ApiError extends Error {
  readonly code: string
  readonly details?: ApiErrorDetail[]
  readonly status?: number

  constructor(code: string, message: string, details?: ApiErrorDetail[], status?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}

/** Narrow an unknown thrown value to the backend's envelope shape. */
function toEnvelope(value: unknown): ApiErrorEnvelope | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) return null
  const { error } = value as { error: unknown }
  if (typeof error !== 'object' || error === null) return null
  if (!('code' in error) || !('message' in error)) return null
  const { code, message } = error as { code: unknown, message: unknown }
  if (typeof code !== 'string' || typeof message !== 'string') return null
  return value as ApiErrorEnvelope
}

/** $fetch rejects with a FetchError carrying the parsed body on `data`. */
function toApiError(cause: unknown): ApiError {
  const response = cause as { data?: unknown, status?: number }
  const envelope = toEnvelope(response?.data)
  if (envelope) {
    const { code, message, details } = envelope.error
    return new ApiError(code, message, details, response.status)
  }
  // No envelope means the request never reached the backend, or something upstream
  // answered in a shape we do not recognise. Either way the raw fetch error must not
  // leak to the UI.
  return new ApiError(
    'NETWORK_ERROR',
    'Could not reach the server. Check your connection and try again.',
    undefined,
    response?.status
  )
}

/**
 * `request` only ever throws ApiError, but a catch block's binding is `unknown`. This
 * narrows it without an assertion, and keeps anything genuinely unexpected presentable.
 */
export function asApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause
  return new ApiError('UNEXPECTED_ERROR', cause instanceof Error ? cause.message : 'Unexpected error')
}

/**
 * The plain-object form of an ApiError. A class instance does not survive Nuxt's payload
 * serialisation from server to client, so anything that crosses that boundary carries
 * this instead — same `code`/`message` contract, on both renders.
 */
export interface ApiErrorInfo {
  code: string
  message: string
  details?: ApiErrorDetail[]
}

export function toApiErrorInfo(error: ApiError): ApiErrorInfo {
  return { code: error.code, message: error.message, details: error.details }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST'
  query?: Record<string, string | number | undefined>
  body?: unknown
}

/**
 * The only place that knows the backend's base URL. Every other composable goes
 * through it; no component calls $fetch directly.
 */
export function useApi() {
  const { public: { apiBase } } = useRuntimeConfig()

  async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    try {
      return await $fetch<T>(`${apiBase}${path}`, {
        method: options.method ?? 'GET',
        query: options.query,
        body: options.body as Record<string, unknown> | undefined
      })
    }
    catch (cause) {
      throw toApiError(cause)
    }
  }

  return { request }
}
