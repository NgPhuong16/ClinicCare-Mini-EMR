import type { ApiError } from '~/composables/useApi'
import type { ConsultationCreate, ConsultationListParams, ConsultationRead } from '~/types/api'
import { asApiError } from '~/composables/useApi'

/**
 * Consultation list and create. One endpoint serves both the list and search pages, so
 * `list` takes the filters rather than there being a second search function.
 */
export function useConsultations() {
  const { request } = useApi()

  const items = ref<ConsultationRead[]>([])
  const pending = ref(false)
  const error = ref<ApiError | null>(null)

  // Filters change as the user types, so list() has the same out-of-order hazard as
  // diagnosis search: only the most recent call may write state.
  let latestRequestId = 0

  async function list(params: ConsultationListParams = {}): Promise<void> {
    const requestId = ++latestRequestId

    pending.value = true
    error.value = null
    try {
      const data = await request<ConsultationRead[]>('/consultations', {
        query: {
          // Omit blank filters entirely rather than sending `?patient=`.
          patient: params.patient?.trim() || undefined,
          code: params.code?.trim() || undefined,
          limit: params.limit,
          offset: params.offset
        }
      })
      if (requestId !== latestRequestId) return
      items.value = data
    }
    catch (cause) {
      if (requestId !== latestRequestId) return
      error.value = asApiError(cause)
      items.value = []
    }
    finally {
      if (requestId === latestRequestId) pending.value = false
    }
  }

  /**
   * Returns the created consultation so the caller can navigate or show it. Rethrows an
   * ApiError — a form needs to know the submit failed, not just watch a ref.
   *
   * No request-counter guard here: this is a single submit whose result goes back to the
   * caller, not shared list state that a later call supersedes.
   */
  async function create(payload: ConsultationCreate): Promise<ConsultationRead> {
    pending.value = true
    error.value = null
    try {
      return await request<ConsultationRead>('/consultations', {
        method: 'POST',
        body: payload
      })
    }
    catch (cause) {
      const apiError = asApiError(cause)
      error.value = apiError
      throw apiError
    }
    finally {
      pending.value = false
    }
  }

  return {
    items: readonly(items),
    pending: readonly(pending),
    error: readonly(error),
    list,
    create
  }
}
