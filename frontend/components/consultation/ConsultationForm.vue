<script setup lang="ts">
import type { ApiErrorInfo } from '~/composables/useApi'
import type { ConsultationCreate, DiagnosisRead } from '~/types/api'

interface Props {
  submitting: boolean
  /** The failure from the last submit, if any. */
  serverError?: ApiErrorInfo | null
  /** Diagnosis search state, owned by the page. */
  diagnosisResults: readonly DiagnosisRead[]
  diagnosisPending: boolean
  diagnosisError: ApiErrorInfo | null
}

const props = withDefaults(defineProps<Props>(), {
  serverError: null
})

const emit = defineEmits<{
  submit: [payload: ConsultationCreate]
  search: [term: string]
}>()

// Mirrors the backend's own constraints, so the user is told before a round trip.
const MAX_NAME = 200
const MAX_NOTES = 5000
const MAX_CODES = 20

const patientName = ref('')
const notes = ref('')
const selected = ref<DiagnosisRead[]>([])
const showErrors = ref(false)

const nameError = computed(() => {
  const trimmed = patientName.value.trim()
  if (!trimmed) return 'Patient name is required.'
  if (trimmed.length > MAX_NAME) return `Patient name must be ${MAX_NAME} characters or fewer.`
  return null
})

const notesError = computed(() =>
  notes.value.trim().length > MAX_NOTES ? `Notes must be ${MAX_NOTES} characters or fewer.` : null
)

const codesError = computed(() => {
  if (selected.value.length === 0) return 'Select at least one diagnosis code.'
  if (selected.value.length > MAX_CODES) return `Select at most ${MAX_CODES} codes.`
  return null
})

const isValid = computed(() => !nameError.value && !notesError.value && !codesError.value)

/**
 * The backend reports field problems as `body.<field>`. Map those onto the matching
 * field; anything else (an unknown code, a network failure) belongs at form level.
 */
const serverFieldErrors = computed(() => {
  const byField: Record<string, string> = {}
  for (const detail of props.serverError?.details ?? []) {
    const field = detail.field.replace(/^body\./, '')
    byField[field] ??= detail.message
  }
  return byField
})

const formLevelServerError = computed(() => {
  if (!props.serverError) return null
  const mapped = Object.keys(serverFieldErrors.value)
  const known = ['patient_name', 'notes', 'diagnosis_codes']
  // If every detail landed on a field, the fields already say it.
  if (mapped.length > 0 && mapped.every(field => known.includes(field))) return null
  return props.serverError.message
})

const shownNameError = computed(() =>
  (showErrors.value ? nameError.value : null) ?? serverFieldErrors.value.patient_name ?? null
)
const shownNotesError = computed(() =>
  (showErrors.value ? notesError.value : null) ?? serverFieldErrors.value.notes ?? null
)
const shownCodesError = computed(() =>
  (showErrors.value ? codesError.value : null) ?? serverFieldErrors.value.diagnosis_codes ?? null
)

function onSubmit(): void {
  showErrors.value = true
  if (!isValid.value || props.submitting) return

  emit('submit', {
    patient_name: patientName.value.trim(),
    notes: notes.value.trim() || null,
    diagnosis_codes: selected.value.map(diagnosis => diagnosis.code)
  })
}
</script>

<template>
  <form novalidate @submit.prevent="onSubmit">
    <p v-if="formLevelServerError" class="form-error" role="alert">
      {{ formLevelServerError }}
    </p>

    <div class="field">
      <label for="patient-name">Patient name</label>
      <input
        id="patient-name"
        v-model="patientName"
        type="text"
        :maxlength="MAX_NAME"
        autocomplete="off"
        :aria-invalid="shownNameError ? true : undefined"
        :aria-describedby="shownNameError ? 'patient-name-error' : undefined"
      >
      <p v-if="shownNameError" id="patient-name-error" class="field-error">
        {{ shownNameError }}
      </p>
    </div>

    <div class="field">
      <DiagnosisSearchSelect
        v-model:selected="selected"
        :results="diagnosisResults"
        :pending="diagnosisPending"
        :error="diagnosisError"
        :max-codes="MAX_CODES"
        :invalid="!!shownCodesError"
        :described-by="shownCodesError ? 'diagnosis-codes-error' : undefined"
        @search="emit('search', $event)"
      />
      <p v-if="shownCodesError" id="diagnosis-codes-error" class="field-error">
        {{ shownCodesError }}
      </p>
    </div>

    <div class="field">
      <label for="notes">Notes <span class="optional">(optional)</span></label>
      <textarea
        id="notes"
        v-model="notes"
        rows="5"
        :maxlength="MAX_NOTES"
        :aria-invalid="shownNotesError ? true : undefined"
        :aria-describedby="shownNotesError ? 'notes-error' : undefined"
      />
      <p v-if="shownNotesError" id="notes-error" class="field-error">
        {{ shownNotesError }}
      </p>
    </div>

    <div class="actions">
      <button type="submit" class="primary" :disabled="submitting">
        {{ submitting ? 'Saving…' : 'Save consultation' }}
      </button>
      <NuxtLink to="/consultations">
        Cancel
      </NuxtLink>
    </div>
  </form>
</template>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 44rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
}

.optional {
  font-weight: 400;
  color: #5a5a5a;
}

input,
textarea {
  padding: 0.5rem 0.625rem;
  border: 1px solid #b9c2cb;
  border-radius: 6px;
  font: inherit;
}

input[aria-invalid='true'],
textarea[aria-invalid='true'] {
  border-color: #b23c3c;
}

.field-error {
  margin: 0;
  color: #8a2020;
  font-size: 0.875rem;
}

.form-error {
  margin: 0;
  padding: 0.75rem 1rem;
  border: 1px solid #d8a7a7;
  border-radius: 6px;
  background: #fdf3f3;
  color: #8a2020;
}

.actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.primary {
  padding: 0.5rem 1rem;
  border: 0;
  border-radius: 6px;
  background: #1f4d7a;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

.primary:hover:not(:disabled),
.primary:focus-visible {
  background: #163a5c;
}

.primary:disabled {
  background: #8b9cad;
  cursor: progress;
}
</style>
