---
description: Fetch real ICD-10-CM codes and (re)generate backend/seeds/icd10_seed.sql
allowed-tools: WebFetch, WebSearch, Read, Write, Bash(uv run:*)
---

Generate (or regenerate) `backend/seeds/icd10_seed.sql`, populating `diagnosis_codes`
(`code TEXT PRIMARY KEY`, `description TEXT NOT NULL` — see `.claude/rules/architecture.md`)
with 100 **real** ICD-10-CM codes.

## Hard rule

Every `(code, description)` pair must come from an actual fetch of
https://www.icd10data.com/ICD10CM/Codes or another authoritative ICD-10-CM listing —
never invented, guessed, or reconstructed from memory. If a fetch fails or is blocked,
stop and say so; do not fill the gap with a plausible-looking code.

## Steps

1. Fetch code listings across **several different chapters** (e.g. endocrine, respiratory,
   musculoskeletal, injury, circulatory) rather than the first 100 codes on one page — the
   app's search/demo is more useful with variety, and it exercises the search endpoint
   across different prefixes and description keywords.
2. Collect exactly 100 `(code, description)` pairs. Dedupe by code. Each code matches the
   ICD-10-CM format (letter + 2 digits, optional `.` + up to 4 alphanumerics, e.g. `E11.9`,
   `S72.001A`). Each description is non-empty and under 500 characters.
3. Write `backend/seeds/icd10_seed.sql` as idempotent SQL, safe to re-run against an
   existing database:
   ```sql
   INSERT INTO diagnosis_codes (code, description) VALUES
     ('E11.9', 'Type 2 diabetes mellitus without complications'),
     ...
   ON CONFLICT (code) DO NOTHING;
   ```
4. Spot-check at least 5 random entries against the source before finishing — confirm the
   description text matches what was actually fetched, not a paraphrase.
5. Report how many codes were collected, from how many source chapters/pages, and any
   codes skipped (malformed, duplicate).
6. Stage and commit only `backend/seeds/icd10_seed.sql` (and `app/scripts/seed.py` if you
   also created/changed the loader) as its own commit:
   `feat(backend): seed 100 ICD-10 diagnosis codes`.

Do not touch unrelated files in this command.
