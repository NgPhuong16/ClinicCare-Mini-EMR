import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DoctorRead } from '~/types/api'
import { AUTH_DOCTOR_STATE_KEY } from '~/composables/useApi'
import { useAuth } from '~/composables/useAuth'

const DOCTOR: DoctorRead = { id: 1, email: 'doctor@cliniccare.local' }

const navigateToMock = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateToMock)

const clearNuxtDataMock = vi.hoisted(() => vi.fn())
mockNuxtImport('clearNuxtData', () => clearNuxtDataMock)

// This file exercises the auth state directly, so it must start from a clean slate
// rather than tests/setup.ts's default "logged in" seed for unrelated tests.
beforeEach(() => {
  clearNuxtState(AUTH_DOCTOR_STATE_KEY)
})

afterEach(() => {
  vi.unstubAllGlobals()
  navigateToMock.mockReset()
  clearNuxtDataMock.mockReset()
  clearNuxtState(AUTH_DOCTOR_STATE_KEY)
})

describe('useAuth.fetchMe', () => {
  it('sets the doctor on success', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(DOCTOR))

    const { doctor, fetchMe } = useAuth()
    const result = await fetchMe()

    expect(result).toEqual(DOCTOR)
    expect(doctor.value).toEqual(DOCTOR)
  })

  it('resolves to null, without throwing, on an UNAUTHORIZED response', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(Object.assign(new Error('fetch failed'), {
      data: { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      status: 401
    })))

    const { doctor, fetchMe } = useAuth()
    const result = await fetchMe()

    expect(result).toBeNull()
    expect(doctor.value).toBeNull()
  })

  it('sets null but rethrows on any other failure', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const { doctor, fetchMe } = useAuth()

    await expect(fetchMe()).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(doctor.value).toBeNull()
  })
})

describe('useAuth.login', () => {
  it('sets the doctor and returns it', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(DOCTOR))

    const { doctor, isLoggedIn, login } = useAuth()
    const result = await login('doctor@cliniccare.local', 'changeme123')

    expect(result).toEqual(DOCTOR)
    expect(doctor.value).toEqual(DOCTOR)
    expect(isLoggedIn.value).toBe(true)
  })

  it('rethrows the backend error and leaves the doctor unset', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(Object.assign(new Error('fetch failed'), {
      data: { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
      status: 401
    })))

    const { doctor, login } = useAuth()

    await expect(login('doctor@cliniccare.local', 'wrong')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Invalid email or password'
    })
    expect(doctor.value).toBeUndefined()
  })
})

describe('useAuth.logout', () => {
  it('clears the doctor, the consultations cache, and navigates to /login', async () => {
    useState<DoctorRead | null | undefined>(AUTH_DOCTOR_STATE_KEY, () => DOCTOR)
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(undefined))

    const { doctor, logout } = useAuth()
    await logout()

    expect(doctor.value).toBeNull()
    expect(clearNuxtDataMock).toHaveBeenCalledWith('consultations-list')
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('posts to the logout endpoint', async () => {
    useState<DoctorRead | null | undefined>(AUTH_DOCTOR_STATE_KEY, () => DOCTOR)
    const stub = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('$fetch', stub)

    await useAuth().logout()

    const [url, options] = stub.mock.calls[0] as [string, { method: string }]
    expect(url.endsWith('/auth/logout')).toBe(true)
    expect(options.method).toBe('POST')
  })

  it('still clears the doctor and navigates to /login when the logout request fails', async () => {
    useState<DoctorRead | null | undefined>(AUTH_DOCTOR_STATE_KEY, () => DOCTOR)
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const { doctor, logout } = useAuth()

    await expect(logout()).resolves.toBeUndefined()
    expect(doctor.value).toBeNull()
    expect(clearNuxtDataMock).toHaveBeenCalledWith('consultations-list')
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })
})
