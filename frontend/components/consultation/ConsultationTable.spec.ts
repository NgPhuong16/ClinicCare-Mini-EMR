import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import type { ConsultationRead } from '~/types/api'
import ConsultationTable from './ConsultationTable.vue'

const CONSULTATION: ConsultationRead = {
  id: 1,
  patient_name: 'Nguyen An',
  notes: 'Routine follow-up',
  created_at: '2026-09-01T09:00:00Z',
  diagnoses: [
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
    { code: 'I10', description: 'Essential (primary) hypertension' }
  ]
}

function mount(consultations: ConsultationRead[]) {
  return mountSuspended(ConsultationTable, { props: { consultations } })
}

describe('ConsultationTable', () => {
  it('renders a row per consultation with the patient name', async () => {
    const table = await mount([
      CONSULTATION,
      { ...CONSULTATION, id: 2, patient_name: 'Tran Bao' }
    ])

    const names = table.findAll('tbody tr td:first-child').map(cell => cell.text())

    expect(names).toEqual(['Nguyen An', 'Tran Bao'])
  })

  it("renders every one of a row's codes, with the description available", async () => {
    const table = await mount([CONSULTATION])

    const codes = table.findAll('.codes li').map(item => item.text())

    expect(codes).toEqual(['E11.9', 'I10'])
    expect(table.find('.codes abbr').attributes('title'))
      .toBe('Type 2 diabetes mellitus without complications')
  })

  it('renders the timestamp as a time element carrying the UTC value', async () => {
    const table = await mount([CONSULTATION])

    const time = table.find('tbody tr time')

    expect(time.exists()).toBe(true)
    // The datetime attribute stays UTC; only the displayed text is localised, and the
    // server never formats that.
    expect(time.attributes('datetime')).toBe('2026-09-01T09:00:00.000Z')
  })

  it('renders a dash for null notes, never the text "null"', async () => {
    const table = await mount([{ ...CONSULTATION, notes: null }])

    const notesCell = table.findAll('tbody tr td').at(3)

    expect(notesCell?.text()).not.toContain('null')
    expect(notesCell?.text()).toContain('—')
    // The glyph is decorative; assistive tech gets real words instead.
    expect(notesCell?.find('[aria-hidden="true"]').exists()).toBe(true)
    expect(notesCell?.find('.visually-hidden').text()).toBe('No notes')
  })

  it('truncates a long note', async () => {
    const table = await mount([{ ...CONSULTATION, notes: 'x'.repeat(200) }])

    const notes = table.findAll('tbody tr td').at(3)?.text() ?? ''

    expect(notes.endsWith('…')).toBe(true)
    expect(notes.length).toBeLessThan(200)
  })

  it('renders only a header when there are no consultations', async () => {
    const table = await mount([])

    expect(table.findAll('tbody tr')).toHaveLength(0)
    expect(table.findAll('thead th')).toHaveLength(4)
  })
})
