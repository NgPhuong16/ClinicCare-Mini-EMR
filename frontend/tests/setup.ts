import { afterEach, beforeEach, vi } from 'vitest'

import { AUTH_DOCTOR_STATE_KEY } from '~/composables/useApi'
import type { DoctorRead } from '~/types/api'

/**
 * Global network guard (testing.md: "Stub the network at $fetch; never hit a real backend
 * from a unit test"). A test that forgets its own vi.stubGlobal('$fetch', ...) must fail
 * loudly and immediately, not silently attempt a real request.
 */
function unstubbedFetch(request: unknown): never {
  throw new Error(
    `$fetch called without a stub for this test (request: ${JSON.stringify(request)}). `
    + 'Add vi.stubGlobal(\'$fetch\', ...) to this test.'
  )
}

const DEFAULT_TEST_DOCTOR: DoctorRead = { id: 1, email: 'doctor@example.com' }

beforeEach(() => {
  vi.stubGlobal('$fetch', unstubbedFetch)
  // The global route middleware calls GET /auth/me on every mounted page or component's
  // first navigation. Most tests have nothing to do with auth, so default to "already
  // logged in" here — otherwise every one of them would need its own stub just to satisfy
  // the middleware. Tests that exercise auth state themselves (useApi, useAuth,
  // middleware specs) manage this key explicitly and are unaffected by this default.
  useState<DoctorRead | null | undefined>(AUTH_DOCTOR_STATE_KEY, () => DEFAULT_TEST_DOCTOR)
})

afterEach(() => {
  vi.unstubAllGlobals()
})
