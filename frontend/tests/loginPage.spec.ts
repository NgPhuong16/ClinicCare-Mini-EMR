import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DoctorRead } from '~/types/api'
import { ApiError } from '~/composables/useApi'
import LoginPage from '~/pages/login.vue'
import { deferred } from './deferred'

const DOCTOR: DoctorRead = { id: 1, email: 'doctor@cliniccare.local' }

const navigateToMock = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateToMock)

const loginMock = vi.hoisted(() => vi.fn())
mockNuxtImport('useAuth', () => vi.fn(() => ({ login: loginMock })))

afterEach(() => {
  navigateToMock.mockReset()
  loginMock.mockReset()
})

async function fillAndSubmit(page: Awaited<ReturnType<typeof mountSuspended>>, email: string, password: string): Promise<void> {
  await page.find('#email').setValue(email)
  await page.find('#password').setValue(password)
  await page.find('form').trigger('submit')
  await flushPromises()
}

describe('login page', () => {
  it('shows validation messages instead of submitting when fields are blank', async () => {
    const page = await mountSuspended(LoginPage)

    await page.find('form').trigger('submit')
    await flushPromises()

    expect(loginMock).not.toHaveBeenCalled()
    expect(page.text()).toContain('Email is required.')
    expect(page.text()).toContain('Password is required.')
  })

  it('logs in and navigates to /consultations on success', async () => {
    loginMock.mockResolvedValue(DOCTOR)

    const page = await mountSuspended(LoginPage)
    await fillAndSubmit(page, 'doctor@cliniccare.local', 'changeme123')

    expect(loginMock).toHaveBeenCalledWith('doctor@cliniccare.local', 'changeme123')
    expect(navigateToMock).toHaveBeenCalledWith('/consultations')
  })

  it('shows the backend message and re-enables submit on a wrong password', async () => {
    loginMock.mockRejectedValue(new ApiError('UNAUTHORIZED', 'Invalid email or password'))

    const page = await mountSuspended(LoginPage)
    await fillAndSubmit(page, 'doctor@cliniccare.local', 'wrong')

    expect(page.find('[role="alert"]').text()).toBe('Invalid email or password')
    expect(page.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('disables submit while the login request is pending', async () => {
    const pending = deferred<DoctorRead>()
    loginMock.mockReturnValue(pending.promise)

    const page = await mountSuspended(LoginPage)
    await fillAndSubmit(page, 'doctor@cliniccare.local', 'changeme123')

    expect(page.find('button[type="submit"]').attributes('disabled')).toBeDefined()

    pending.resolve(DOCTOR)
    await flushPromises()
  })
})
