import type { ApiError, ApiErrorInfo } from '~/composables/useApi'
import type { ConsultationCreate, ConsultationListParams, ConsultationRead } from '~/types/api'
import { asApiError, toApiErrorInfo } from '~/composables/useApi'

/** What the SSR handler returns. Plain objects only — this crosses the payload. */
interface ConsultationListResult {
  rows: ConsultationRead[]
  error: ApiErrorInfo | null
}

/**
 * Page-load data for the consultations list: fetched on the server on a hard load and
 * reused from the payload on hydration, re-run in the browser on NuxtLink navigation.
 *
 * `lazy` so a navigation switches pages immediately and shows the loading state instead
 * of freezing on the previous page; the server still fetches before sending HTML.
 *
 * The handler never throws. useAsyncData would wrap a thrown ApiError, and a class
 * instance does not survive payload serialisation — the client would see a different
 * shape from the server. Returning the failure as plain data keeps `error` identical on
 * both renders.
 */
export function useConsultationList() {
  const { request } = useApi()

  const query = useAsyncData<ConsultationListResult>(
    'consultations-list',
    async () => {
      try {
        // Deliberately unfiltered and parameterless: the key is fixed, so a filtered
        // variant would share this cache entry and never refetch when the filter changed.
        // Filtered views use the browser-side list() instead.
        const rows = await request<ConsultationRead[]>('/consultations')
        return { rows, error: null }
      }
      catch (cause) {
        return { rows: [], error: toApiErrorInfo(asApiError(cause)) }
      }
    },
    { lazy: true }
  )

  const consultations = computed<ConsultationRead[]>(() => query.data.value?.rows ?? [])
  const error = computed<ApiErrorInfo | null>(() => {
    if (query.data.value?.error) return query.data.value.error
    // Defensive: nothing should reach useAsyncData's own error channel, but if it does,
    // present it in the same shape rather than leaking a raw error to the page.
    const unexpected = query.error.value
    return unexpected ? { code: 'UNEXPECTED_ERROR', message: unexpected.message } : null
  })

  return {
    consultations,
    pending: query.pending,
    error,
    refresh: query.refresh
  }
}

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
