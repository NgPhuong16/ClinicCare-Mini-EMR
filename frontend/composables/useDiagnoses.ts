import type { ApiError } from '~/composables/useApi'
import type { DiagnosisRead } from '~/types/api'
import { asApiError } from '~/composables/useApi'

/** ICD-10 search. State is read-only to callers; `search` and `reset` are the way in. */
export function useDiagnoses() {
  const { request } = useApi()

  const results = ref<DiagnosisRead[]>([])
  const pending = ref(false)
  const error = ref<ApiError | null>(null)

  // Typing into the search box fires a call per debounced keystroke, and responses can
  // arrive out of order — "e1" settling after "e11" would overwrite the newer matches
  // while the input still reads "e11". Only the most recent call may write state; an
  // earlier one that settles late is dropped.
  let latestRequestId = 0

  async function search(term: string, limit = 20): Promise<void> {
    const requestId = ++latestRequestId

    // The backend rejects a blank term with 422 rather than dumping the table; don't
    // spend a request to find that out.
    if (!term.trim()) {
      results.value = []
      error.value = null
      pending.value = false
      return
    }

    pending.value = true
    error.value = null
    try {
      const data = await request<DiagnosisRead[]>('/diagnoses', {
        query: { search: term, limit }
      })
      if (requestId !== latestRequestId) return
      results.value = data
    }
    catch (cause) {
      if (requestId !== latestRequestId) return
      error.value = asApiError(cause)
      results.value = []
    }
    finally {
      // Leave pending alone if a newer call is still in flight.
      if (requestId === latestRequestId) pending.value = false
    }
  }

  function reset(): void {
    // Invalidate anything in flight, so a response arriving after a reset cannot
    // repopulate a list the caller just cleared.
    latestRequestId++
    results.value = []
    error.value = null
    pending.value = false
  }

  return {
    results: readonly(results),
    pending: readonly(pending),
    error: readonly(error),
    search,
    reset
  }
}
