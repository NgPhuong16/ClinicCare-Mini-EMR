import type { DoctorRead, LoginRequest } from '~/types/api'
import { AUTH_DOCTOR_STATE_KEY, asApiError } from '~/composables/useApi'

/**
 * The signed-in doctor. `undefined` = not checked yet, `null` = checked and signed out,
 * otherwise the doctor from the last successful /auth/me, /auth/login or /auth/logout.
 * JS cannot read the httpOnly session cookie, so this state — filled once by the global
 * middleware — is the only way the app knows who, if anyone, is signed in.
 */
export function useAuth() {
  const { request } = useApi()
  const doctor = useState<DoctorRead | null | undefined>(AUTH_DOCTOR_STATE_KEY, () => undefined)

  const isLoggedIn = computed(() => doctor.value != null)

  /**
   * Resolves the doctor from the session cookie, or null if there isn't one. Rethrows
   * anything other than "not logged in" so the caller — the global middleware, on the
   * first navigation — can see a genuine failure rather than silently treating it as
   * logged out.
   */
  async function fetchMe(): Promise<DoctorRead | null> {
    try {
      doctor.value = await request<DoctorRead>('/auth/me')
    }
    catch (cause) {
      doctor.value = null
      const apiError = asApiError(cause)
      if (apiError.code !== 'UNAUTHORIZED') throw apiError
    }
    return doctor.value
  }

  async function login(email: string, password: string): Promise<DoctorRead> {
    const payload: LoginRequest = { email, password }
    const result = await request<DoctorRead>('/auth/login', { method: 'POST', body: payload })
    doctor.value = result
    return result
  }

  async function logout(): Promise<void> {
    await request('/auth/logout', { method: 'POST' })
    doctor.value = null
    // Without this the next person to log in on this browser would briefly see the
    // previous doctor's cached consultations until the list refetches on its own.
    clearNuxtData('consultations-list')
    await navigateTo('/login')
  }

  return {
    doctor: readonly(doctor),
    isLoggedIn,
    fetchMe,
    login,
    logout
  }
}
