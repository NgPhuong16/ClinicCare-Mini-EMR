<script setup lang="ts">
import type { ApiErrorInfo } from '~/composables/useApi'
import type { ConsultationCreate } from '~/types/api'
import { asApiError, toApiErrorInfo } from '~/composables/useApi'

const { create } = useConsultations()
const { results, pending: diagnosisPending, error: diagnosisError, search } = useDiagnoses()

const submitError = ref<ApiErrorInfo | null>(null)

/**
 * Not create()'s own `pending`: that clears in its `finally`, before `navigateTo` has
 * resolved, briefly re-enabling the button. A second click in that window would create a
 * duplicate consultation. On success this stays true until the page unmounts.
 */
const saving = ref(false)

useHead({ title: 'New consultation — ClinicCare' })

async function onSubmit(payload: ConsultationCreate): Promise<void> {
  submitError.value = null
  saving.value = true
  try {
    await create(payload)
    // A different route, so the list page mounts fresh and refetches — the new row is
    // there without an explicit refresh.
    await navigateTo('/consultations')
  }
  catch (cause) {
    // create() rethrows so the form can react; keep the user's input and show why.
    submitError.value = toApiErrorInfo(asApiError(cause))
    saving.value = false
  }
}
</script>

<template>
  <section>
    <h1>New consultation</h1>

    <ConsultationForm
      :submitting="saving"
      :server-error="submitError"
      :diagnosis-results="results"
      :diagnosis-pending="diagnosisPending"
      :diagnosis-error="diagnosisError"
      @submit="onSubmit"
      @search="search"
    />
  </section>
</template>

<style scoped>
h1 {
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
}
</style>
