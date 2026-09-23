<script setup lang="ts">
import type { DiagnosisRead } from '~/types/api'

const { items, pending, error, list } = useConsultations()
const {
  results: diagnosisResults,
  pending: diagnosisPending,
  error: diagnosisError,
  search: searchDiagnoses,
  reset: resetDiagnoses
} = useDiagnoses()

useHead({ title: 'Search consultations — ClinicCare' })

const DEBOUNCE_MS = 300

const patient = ref('')
const debouncedPatient = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(patient, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedPatient.value = value
  }, DEBOUNCE_MS)
})

onUnmounted(() => clearTimeout(debounceTimer))

// The backend matches ?code= exactly, so typing "E11" would never find "E11.9". The code
// filter is therefore chosen from search results rather than typed free-hand.
const selectedCodes = ref<DiagnosisRead[]>([])
const code = computed(() => selectedCodes.value[0]?.code ?? '')

const hasFilter = computed(() => debouncedPatient.value.trim() !== '' || code.value !== '')

// The backend ANDs the two filters; list() is latest-call-wins, so an older response
// cannot overwrite a newer one as the user keeps typing.
watch([debouncedPatient, code], () => {
  if (!hasFilter.value) return
  list({ patient: debouncedPatient.value, code: code.value || undefined })
})

/** The picker owns its search term internally; remounting is how we reset it. */
const pickerKey = ref(0)

function clearFilters(): void {
  patient.value = ''
  debouncedPatient.value = ''
  selectedCodes.value = []
  // Without these the code box still shows the last term searched, with its result list
  // open — it looks like a filter is still applied when none is.
  resetDiagnoses()
  pickerKey.value += 1
}
</script>

<template>
  <section>
    <h1>Search consultations</h1>

    <div class="filters">
      <div class="field">
        <label for="patient-filter">Patient name</label>
        <input
          id="patient-filter"
          v-model="patient"
          type="search"
          autocomplete="off"
          placeholder="Any part of the name, e.g. nguyen"
        >
      </div>

      <div class="field">
        <DiagnosisSearchSelect
          :key="pickerKey"
          v-model:selected="selectedCodes"
          input-id="code-filter"
          label="Diagnosis code"
          placeholder="Pick a code, e.g. diab or E11"
          :max-codes="1"
          :results="diagnosisResults"
          :pending="diagnosisPending"
          :error="diagnosisError"
          @search="searchDiagnoses"
        />
      </div>
    </div>

    <p v-if="hasFilter" class="clear-row">
      <button type="button" class="link-button" @click="clearFilters">
        Clear filters
      </button>
    </p>

    <p v-if="!hasFilter" class="prompt">
      Enter a patient name or pick a diagnosis code to search.
    </p>

    <p v-else-if="pending" role="status">
      Searching…
    </p>

    <p v-else-if="error" role="alert" class="error">
      {{ error.message }}
    </p>

    <p v-else-if="items.length === 0" class="empty">
      No consultations match these filters.
    </p>

    <ConsultationTable v-else :consultations="items" />
  </section>
</template>

<style scoped>
h1 {
  margin: 0 0 1.5rem;
  font-size: 1.5rem;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: 1.5rem;
  align-items: start;
  margin-bottom: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
}

input {
  padding: 0.5rem 0.625rem;
  border: 1px solid #b9c2cb;
  border-radius: 6px;
  font: inherit;
}

.clear-row {
  margin: 0 0 1rem;
}

.link-button {
  padding: 0;
  border: 0;
  background: none;
  color: #30506b;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.error {
  padding: 0.75rem 1rem;
  border: 1px solid #d8a7a7;
  border-radius: 6px;
  background: #fdf3f3;
  color: #8a2020;
}

.prompt,
.empty {
  color: #5a5a5a;
}
</style>
