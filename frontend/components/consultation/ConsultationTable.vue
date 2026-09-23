<script setup lang="ts">
import type { ConsultationRead } from '~/types/api'

interface Props {
  consultations: ConsultationRead[]
}

const props = defineProps<Props>()

const NOTES_EXCERPT_LENGTH = 120

/** Rows only — loading, empty and error states belong to the page. */
const rows = computed(() => props.consultations.map(consultation => ({
  ...consultation,
  notesExcerpt: excerpt(consultation.notes)
})))

function excerpt(notes: string | null): string | null {
  if (!notes) return null
  const collapsed = notes.replace(/\s+/g, ' ').trim()
  if (!collapsed) return null
  return collapsed.length > NOTES_EXCERPT_LENGTH
    ? `${collapsed.slice(0, NOTES_EXCERPT_LENGTH).trimEnd()}…`
    : collapsed
}
</script>

<template>
  <table class="consultations">
    <caption class="visually-hidden">
      Recorded consultations, newest first
    </caption>
    <thead>
      <tr>
        <th scope="col">
          Patient
        </th>
        <th scope="col">
          Recorded
        </th>
        <th scope="col">
          Diagnosis codes
        </th>
        <th scope="col">
          Notes
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.id">
        <td>{{ row.patient_name }}</td>
        <td>
          <!--
            NuxtTime renders a semantic <time datetime="<ISO UTC>">. The server formats in
            its own zone, then an onPrehydrate script rewrites the text in the browser's
            zone before Vue hydrates, so there is no mismatch and no hardcoded timeZone.
          -->
          <NuxtTime
            :datetime="row.created_at"
            year="numeric"
            month="short"
            day="numeric"
            hour="2-digit"
            minute="2-digit"
          />
        </td>
        <td>
          <ul class="codes">
            <li v-for="diagnosis in row.diagnoses" :key="diagnosis.code">
              <abbr :title="diagnosis.description">{{ diagnosis.code }}</abbr>
            </li>
          </ul>
        </td>
        <td>
          <span v-if="row.notesExcerpt">{{ row.notesExcerpt }}</span>
          <template v-else>
            <!-- aria-label on a plain span is not reliably announced; hide the glyph and
                 give screen readers real text instead. -->
            <span class="muted" aria-hidden="true">—</span>
            <span class="visually-hidden">No notes</span>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.consultations {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid #e2e2e2;
}

th {
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #5a5a5a;
}

.codes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.codes li {
  padding: 0.125rem 0.5rem;
  background: #eef2f6;
  border-radius: 999px;
  font-size: 0.875rem;
}

.codes abbr {
  text-decoration: none;
  border-bottom: 1px dotted #7b8a99;
  cursor: help;
}

.muted {
  color: #767676;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
