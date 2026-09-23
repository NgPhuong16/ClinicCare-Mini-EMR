<script setup lang="ts">
import type { ApiErrorInfo } from '~/composables/useApi'
import type { DiagnosisRead } from '~/types/api'

interface Props {
  /** Search results, owned and fetched by the page. */
  results: readonly DiagnosisRead[]
  pending: boolean
  error: ApiErrorInfo | null
  /** Currently chosen codes. This component never mutates them; it emits a new list. */
  selected: readonly DiagnosisRead[]
  /** `1` turns this into a single-select: picking a code replaces the current one. */
  maxCodes?: number
  label?: string
  placeholder?: string
  inputId?: string
  describedBy?: string
  invalid?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxCodes: 20,
  label: 'Diagnosis codes',
  placeholder: 'Search by code or description, e.g. diab or E11',
  inputId: 'diagnosis-search',
  describedBy: undefined,
  invalid: false
})

const emit = defineEmits<{
  search: [term: string]
  'update:selected': [codes: DiagnosisRead[]]
}>()

const DEBOUNCE_MS = 300

const term = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined

// Single-select never "fills up": picking replaces, so the input stays usable.
const isSingle = computed(() => props.maxCodes === 1)
const atLimit = computed(() => !isSingle.value && props.selected.length >= props.maxCodes)
const selectedCodes = computed(() => new Set(props.selected.map(d => d.code)))
const addable = computed(() => props.results.filter(d => !selectedCodes.value.has(d.code)))

watch(term, (value) => {
  // Debounce with a plain timer — no dependency for a five-line behaviour.
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => emit('search', value), DEBOUNCE_MS)
})

onUnmounted(() => clearTimeout(debounceTimer))

function add(diagnosis: DiagnosisRead): void {
  if (isSingle.value) {
    emit('update:selected', [diagnosis])
    // The choice is made, so drop the term and let the list close. Multi-select keeps
    // both, where the same search is usually the source of the next code too.
    term.value = ''
    return
  }
  if (atLimit.value || selectedCodes.value.has(diagnosis.code)) return
  emit('update:selected', [...props.selected, diagnosis])
}

function remove(code: string): void {
  emit('update:selected', props.selected.filter(d => d.code !== code))
}

/** Enter in the search box takes the first code not already chosen. */
function addFirstMatch(): void {
  const first = addable.value[0]
  if (first) add(first)
}
</script>

<template>
  <div class="picker">
    <label :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      v-model="term"
      type="search"
      autocomplete="off"
      :placeholder="placeholder"
      :aria-describedby="describedBy"
      :aria-invalid="invalid || undefined"
      :disabled="atLimit"
      @keydown.enter.prevent="addFirstMatch"
    >

    <p v-if="atLimit" class="hint">
      Maximum of {{ maxCodes }} codes reached. Remove one to add another.
    </p>

    <p v-if="pending" class="hint" role="status">
      Searching…
    </p>
    <p v-else-if="error" class="field-error" role="alert">
      {{ error.message }}
    </p>
    <p v-else-if="term.trim() && addable.length === 0" class="hint">
      No matching codes.
    </p>

    <ul v-else-if="term.trim() && addable.length" class="results">
      <li v-for="diagnosis in addable" :key="diagnosis.code">
        <button type="button" :disabled="atLimit" @click="add(diagnosis)">
          <span class="code">{{ diagnosis.code }}</span>
          <span class="description">{{ diagnosis.description }}</span>
        </button>
      </li>
    </ul>

    <ul v-if="selected.length" class="chips" :aria-label="isSingle ? 'Selected diagnosis code' : 'Selected diagnosis codes'">
      <li v-for="diagnosis in selected" :key="diagnosis.code" class="chip">
        <span class="code">{{ diagnosis.code }}</span>
        <span class="description">{{ diagnosis.description }}</span>
        <button
          type="button"
          class="remove"
          :aria-label="`Remove ${diagnosis.code}`"
          @click="remove(diagnosis.code)"
        >
          ×
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.picker {
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

input[aria-invalid='true'] {
  border-color: #b23c3c;
}

.results {
  max-height: 14rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border: 1px solid #e2e2e2;
  border-radius: 6px;
  list-style: none;
}

.results button {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.results button:hover:not(:disabled),
.results button:focus-visible {
  background: #eef2f6;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.375rem 0.25rem 0.625rem;
  background: #eef2f6;
  border-radius: 999px;
}

.chip .description {
  max-width: 22rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #4a4a4a;
  font-size: 0.875rem;
}

.remove {
  width: 1.5rem;
  height: 1.5rem;
  border: 0;
  border-radius: 50%;
  background: #d7dee6;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.remove:hover,
.remove:focus-visible {
  background: #c2ccd7;
}

.code {
  font-weight: 600;
}

.hint {
  margin: 0;
  color: #5a5a5a;
  font-size: 0.875rem;
}

.field-error {
  margin: 0;
  color: #8a2020;
  font-size: 0.875rem;
}
</style>
