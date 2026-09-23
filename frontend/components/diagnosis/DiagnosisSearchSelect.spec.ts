import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DiagnosisRead } from '~/types/api'
import DiagnosisSearchSelect from './DiagnosisSearchSelect.vue'

const DIABETES: DiagnosisRead = {
  code: 'E11.9',
  description: 'Type 2 diabetes mellitus without complications'
}
const HYPERGLYCEMIA: DiagnosisRead = {
  code: 'E11.65',
  description: 'Type 2 diabetes mellitus with hyperglycemia'
}

function mount(props: Partial<InstanceType<typeof DiagnosisSearchSelect>['$props']> = {}) {
  return mountSuspended(DiagnosisSearchSelect, {
    props: {
      results: [],
      pending: false,
      error: null,
      selected: [],
      ...props
    }
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('DiagnosisSearchSelect search', () => {
  it('emits search once after rapid typing, with the final term', async () => {
    vi.useFakeTimers()
    const picker = await mount()
    const input = picker.find('input')

    for (const term of ['d', 'di', 'dia', 'diab']) {
      await input.setValue(term)
    }
    // Nothing yet — the debounce has not elapsed.
    expect(picker.emitted('search')).toBeUndefined()
    vi.advanceTimersByTime(300)

    expect(picker.emitted('search')).toHaveLength(1)
    expect(picker.emitted('search')?.[0]).toEqual(['diab'])
  })

  it('shows the backend error rather than swallowing it', async () => {
    const picker = await mount({
      error: { code: 'VALIDATION_ERROR', message: 'Search term must not be empty' }
    })

    expect(picker.text()).toContain('Search term must not be empty')
  })
})

describe('DiagnosisSearchSelect multi-select', () => {
  it('adds a clicked code to the selection', async () => {
    const picker = await mount({ results: [DIABETES] })
    await picker.find('input').setValue('diab')

    await picker.find('.results button').trigger('click')

    expect(picker.emitted('update:selected')?.[0]).toEqual([[DIABETES]])
  })

  it('removes a selected code', async () => {
    const picker = await mount({ selected: [DIABETES, HYPERGLYCEMIA] })

    await picker.find(`[aria-label="Remove ${DIABETES.code}"]`).trigger('click')

    expect(picker.emitted('update:selected')?.[0]).toEqual([[HYPERGLYCEMIA]])
  })

  it('never offers an already-selected code, so it cannot be added twice', async () => {
    const picker = await mount({ results: [DIABETES, HYPERGLYCEMIA], selected: [DIABETES] })
    await picker.find('input').setValue('diab')

    const offered = picker.findAll('.results button').map(button => button.text())

    expect(offered).toHaveLength(1)
    expect(offered[0]).toContain(HYPERGLYCEMIA.code)
  })

  it('stops accepting codes at the 20-code cap', async () => {
    const selected = Array.from({ length: 20 }, (_, i) => ({
      code: `Q${i.toString().padStart(2, '0')}.0`,
      description: `Test condition ${i}`
    }))
    // Type while still under the cap — that is the only way a term exists, since the
    // input disables once the cap is reached.
    const picker = await mount({ results: [DIABETES], selected: selected.slice(0, 19) })
    await picker.find('input').setValue('diab')

    await picker.setProps({ selected })

    expect(picker.find('input').attributes('disabled')).toBeDefined()
    expect(picker.text()).toContain('Maximum of 20 codes reached')
    expect(picker.find('.results button').attributes('disabled')).toBeDefined()
    await picker.find('.results button').trigger('click')
    expect(picker.emitted('update:selected')).toBeUndefined()
  })

  it('keeps the term and the result list after adding, ready for the next code', async () => {
    const picker = await mount({ results: [DIABETES, HYPERGLYCEMIA] })
    await picker.find('input').setValue('diab')

    await picker.find('.results button').trigger('click')

    expect((picker.find('input').element as HTMLInputElement).value).toBe('diab')
    expect(picker.find('.results').exists()).toBe(true)
  })
})

describe('DiagnosisSearchSelect single-select', () => {
  it('replaces the current code instead of appending', async () => {
    const picker = await mount({
      maxCodes: 1,
      results: [HYPERGLYCEMIA],
      selected: [DIABETES]
    })
    await picker.find('input').setValue('diab')

    await picker.find('.results button').trigger('click')

    expect(picker.emitted('update:selected')?.[0]).toEqual([[HYPERGLYCEMIA]])
  })

  it('clears the term and closes the result list once a code is picked', async () => {
    const picker = await mount({ maxCodes: 1, results: [DIABETES, HYPERGLYCEMIA] })
    await picker.find('input').setValue('diab')
    expect(picker.find('.results').exists()).toBe(true)

    await picker.find('.results button').trigger('click')

    expect((picker.find('input').element as HTMLInputElement).value).toBe('')
    expect(picker.find('.results').exists()).toBe(false)
  })

  it('never disables the input, since picking replaces rather than fills up', async () => {
    const picker = await mount({ maxCodes: 1, results: [HYPERGLYCEMIA], selected: [DIABETES] })
    await picker.find('input').setValue('diab')

    expect(picker.find('input').attributes('disabled')).toBeUndefined()
    expect(picker.text()).not.toContain('Maximum of')
  })
})

describe('DiagnosisSearchSelect keyboard', () => {
  it('adds the first unselected match on Enter', async () => {
    const picker = await mount({ results: [DIABETES, HYPERGLYCEMIA], selected: [DIABETES] })
    await picker.find('input').setValue('diab')

    await picker.find('input').trigger('keydown.enter')

    // DIABETES is already selected, so the first *addable* match wins.
    expect(picker.emitted('update:selected')?.[0]).toEqual([[DIABETES, HYPERGLYCEMIA]])
  })

  it('does nothing on Enter when there is no match to add', async () => {
    const picker = await mount({ results: [] })
    await picker.find('input').setValue('zzz')

    await picker.find('input').trigger('keydown.enter')

    expect(picker.emitted('update:selected')).toBeUndefined()
  })
})
