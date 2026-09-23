import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import type { DiagnosisRead } from '~/types/api'
import DiagnosisSearchSelect from '../diagnosis/DiagnosisSearchSelect.vue'
import ConsultationForm from './ConsultationForm.vue'

const DIABETES: DiagnosisRead = {
  code: 'E11.9',
  description: 'Type 2 diabetes mellitus without complications'
}

function mount(props: Partial<InstanceType<typeof ConsultationForm>['$props']> = {}) {
  return mountSuspended(ConsultationForm, {
    props: {
      submitting: false,
      diagnosisResults: [],
      diagnosisPending: false,
      diagnosisError: null,
      ...props
    }
  })
}

type Form = Awaited<ReturnType<typeof mount>>

/** The picker is a child component; codes arrive through its update:selected event. */
async function selectCodes(form: Form, codes: DiagnosisRead[]): Promise<void> {
  await form.findComponent(DiagnosisSearchSelect).vm.$emit('update:selected', codes)
}

describe('ConsultationForm validation', () => {
  it('rejects a blank patient name', async () => {
    const form = await mount()
    await selectCodes(form, [DIABETES])

    await form.find('form').trigger('submit')

    expect(form.text()).toContain('Patient name is required.')
    expect(form.emitted('submit')).toBeUndefined()
  })

  it('rejects a whitespace-only patient name, which maxlength alone would accept', async () => {
    const form = await mount()
    await form.find('#patient-name').setValue('   ')
    await selectCodes(form, [DIABETES])

    await form.find('form').trigger('submit')

    expect(form.text()).toContain('Patient name is required.')
    expect(form.emitted('submit')).toBeUndefined()
  })

  it('rejects a patient name longer than 200 characters', async () => {
    const form = await mount()
    await form.find('#patient-name').setValue('a'.repeat(201))
    await selectCodes(form, [DIABETES])

    await form.find('form').trigger('submit')

    expect(form.text()).toContain('Patient name must be 200 characters or fewer.')
    expect(form.emitted('submit')).toBeUndefined()
  })

  it('rejects a submit with no diagnosis codes', async () => {
    const form = await mount()
    await form.find('#patient-name').setValue('Nguyen An')

    await form.find('form').trigger('submit')

    expect(form.text()).toContain('Select at least one diagnosis code.')
    expect(form.emitted('submit')).toBeUndefined()
  })

  it('stays quiet until the first submit attempt', async () => {
    const form = await mount()

    expect(form.text()).not.toContain('Patient name is required.')
    expect(form.text()).not.toContain('Select at least one diagnosis code.')
  })
})

describe('ConsultationForm submit', () => {
  it('emits a payload with the name trimmed and the codes as strings', async () => {
    const form = await mount()
    await form.find('#patient-name').setValue('  Nguyen An  ')
    await form.find('#notes').setValue('  Routine follow-up  ')
    await selectCodes(form, [DIABETES, { code: 'I10', description: 'Essential hypertension' }])

    await form.find('form').trigger('submit')

    expect(form.emitted('submit')?.[0]).toEqual([{
      patient_name: 'Nguyen An',
      notes: 'Routine follow-up',
      diagnosis_codes: ['E11.9', 'I10']
    }])
  })

  it('sends null notes rather than an empty string', async () => {
    const form = await mount()
    await form.find('#patient-name').setValue('Nguyen An')
    await form.find('#notes').setValue('   ')
    await selectCodes(form, [DIABETES])

    await form.find('form').trigger('submit')

    expect(form.emitted('submit')?.[0]).toEqual([{
      patient_name: 'Nguyen An',
      notes: null,
      diagnosis_codes: ['E11.9']
    }])
  })

  it('disables submit while submitting, so a double click cannot create two records', async () => {
    const form = await mount({ submitting: true })
    await form.find('#patient-name').setValue('Nguyen An')
    await selectCodes(form, [DIABETES])

    const submit = form.find('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(submit.text()).toContain('Saving')
    await form.find('form').trigger('submit')

    expect(form.emitted('submit')).toBeUndefined()
  })
})

describe('ConsultationForm server errors', () => {
  it('maps a body.patient_name detail onto the patient name field', async () => {
    const form = await mount({
      serverError: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ field: 'body.patient_name', message: 'Value error, must not be blank' }]
      }
    })

    const fieldError = form.find('#patient-name-error')
    expect(fieldError.exists()).toBe(true)
    expect(fieldError.text()).toBe('Value error, must not be blank')
  })

  it('maps a body.diagnosis_codes detail onto the codes field', async () => {
    const form = await mount({
      serverError: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{
          field: 'body.diagnosis_codes',
          message: 'List should have at least 1 item after validation, not 0'
        }]
      }
    })

    expect(form.find('#diagnosis-codes-error').text())
      .toContain('List should have at least 1 item')
    // Fully mapped, so the generic message is not repeated at form level.
    expect(form.find('.form-error').exists()).toBe(false)
  })

  it('shows an error with no field details at form level', async () => {
    const form = await mount({
      serverError: { code: 'VALIDATION_ERROR', message: 'Unknown diagnosis code(s): Z99.9' }
    })

    expect(form.find('.form-error').text()).toBe('Unknown diagnosis code(s): Z99.9')
  })
})
