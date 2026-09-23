import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ConsultationRead } from '~/types/api'
import NewConsultationPage from '~/pages/consultations/new.vue'
import { deferred } from './deferred'

const CREATED: ConsultationRead = {
  id: 1,
  patient_name: 'Nguyen An',
  notes: null,
  created_at: '2026-09-24T07:34:01Z',
  diagnoses: [{ code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' }]
}

const navigateToMock = vi.hoisted(() => vi.fn())
mockNuxtImport('navigateTo', () => navigateToMock)

afterEach(() => {
  vi.unstubAllGlobals()
  navigateToMock.mockReset()
})

describe('new consultation page', () => {
  it('keeps submit disabled between a successful create and the navigation settling', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(CREATED))
    // Hold the navigation open — this is exactly the window in which create()'s own
    // `pending` has already cleared.
    const navigation = deferred<undefined>()
    navigateToMock.mockReturnValue(navigation.promise)

    const page = await mountSuspended(NewConsultationPage)
    const form = page.findComponent({ name: 'ConsultationForm' })
    form.vm.$emit('submit', { patient_name: 'Nguyen An', diagnosis_codes: ['E11.9'] })
    // Flushes create(); navigateTo stays pending, which is the window under test.
    await flushPromises()

    const submit = page.find('button[type="submit"]')
    expect(navigateToMock).toHaveBeenCalledWith('/consultations')
    expect(submit.attributes('disabled')).toBeDefined()

    navigation.resolve(undefined)
  })

  it('re-enables submit and shows the error when create fails', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(Object.assign(new Error('fetch failed'), {
      data: { error: { code: 'VALIDATION_ERROR', message: 'Unknown diagnosis code(s): Z99.9' } },
      status: 422
    })))

    const page = await mountSuspended(NewConsultationPage)
    const form = page.findComponent({ name: 'ConsultationForm' })
    form.vm.$emit('submit', { patient_name: 'Nguyen An', diagnosis_codes: ['Z99.9'] })
    await flushPromises()

    expect(navigateToMock).not.toHaveBeenCalled()
    expect(page.text()).toContain('Unknown diagnosis code(s): Z99.9')
    expect(page.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })
})
