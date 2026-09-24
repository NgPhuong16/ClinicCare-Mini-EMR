import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

import type { DoctorRead } from '~/types/api'
import authMiddleware from '~/middleware/auth.global'

const DOCTOR: DoctorRead = { id: 1, email: 'doctor@cliniccare.local' }

const navigateToMock = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateToMock)

const fetchMeMock = vi.hoisted(() => vi.fn())
const useAuthMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useAuth', () => useAuthMock)

function route(path: string): RouteLocationNormalizedLoaded {
  return { path, fullPath: path } as RouteLocationNormalizedLoaded
}

/** A useAuth() stand-in whose `isLoggedIn.value` tracks `doctor.value` live, the way the
 * real computed() does — needed because fetchMe can mutate `doctor` mid-test. */
function stubUseAuth(initial: DoctorRead | null | undefined): { value: DoctorRead | null | undefined } {
  const doctor = { value: initial }
  const isLoggedIn = { get value() { return doctor.value != null } }
  useAuthMock.mockReturnValue({ doctor, isLoggedIn, fetchMe: fetchMeMock })
  return doctor
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('auth.global middleware', () => {
  it('awaits fetchMe when the doctor has not been resolved yet, then redirects a logged-out visitor', async () => {
    const doctor = stubUseAuth(undefined)
    fetchMeMock.mockImplementation(async () => {
      doctor.value = null
    })

    await authMiddleware(route('/consultations'), route('/'))

    expect(fetchMeMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/consultations' } })
  })

  it('does not call fetchMe again once the doctor is already known', async () => {
    stubUseAuth(null)

    await authMiddleware(route('/consultations'), route('/'))

    expect(fetchMeMock).not.toHaveBeenCalled()
    expect(navigateToMock).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/consultations' } })
  })

  it('lets a logged-in doctor through without redirecting', async () => {
    stubUseAuth(DOCTOR)

    await authMiddleware(route('/consultations'), route('/'))

    expect(fetchMeMock).not.toHaveBeenCalled()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('bounces a logged-in doctor away from /login', async () => {
    stubUseAuth(DOCTOR)

    await authMiddleware(route('/login'), route('/'))

    expect(navigateToMock).toHaveBeenCalledWith('/consultations')
  })

  it('lets a logged-out visitor reach /login without redirecting', async () => {
    stubUseAuth(null)

    await authMiddleware(route('/login'), route('/'))

    expect(navigateToMock).not.toHaveBeenCalled()
  })
})
