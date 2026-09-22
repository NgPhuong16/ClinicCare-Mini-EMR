# Architecture

Read this before adding a module, an endpoint, a table, or a page.

## Shape of the system

Two deployables, one repo, HTTP as the only contract between them.

```
kyanon/
├── CLAUDE.md
├── .claude/
├── backend/          FastAPI, owns all business rules and the database
└── frontend/         Nuxt 3 SPA/SSR, owns presentation only
```

There is no shared code, no generated client, no BFF layer. The frontend hand-writes its
TypeScript types in `types/api.ts` to mirror the backend's Pydantic schemas. If a schema
changes, that file changes in the same commit.

## Backend layering

A layered architecture, not full Clean/Hexagonal — the domain is two entities and does not
justify ports/adapters ceremony. What matters is the **dependency direction**, which is
one-way and enforced by review:

```
api  →  services  →  repositories  →  models/db
 ↓         ↓
schemas  domain exceptions
```

### `app/api/`

HTTP only. A route function does four things: declare its request/response schema, resolve
dependencies with `Depends`, call exactly one service method, return the result. It maps
nothing, loops over nothing, and computes nothing.

Forbidden here: `import sqlalchemy`, `session.execute`, ORM model imports, business
conditionals ("if the note has no codes then…").

### `app/services/`

All business rules. A service receives already-validated Pydantic input plus a `Session`,
orchestrates one or more repositories, and returns ORM objects or plain values. It owns
transaction boundaries: it calls `session.commit()`, routes never do.

Services raise **domain exceptions** from `app/core/exceptions.py` (`NotFoundError`,
`ConflictError`, `ValidationError`). They never import `fastapi` or raise `HTTPException` —
that coupling is what makes services untestable.

### `app/repositories/`

Every `select`, `insert`, `update`, `delete` lives here, and nowhere else. A repository
takes a `Session` as its first argument, speaks in ORM models and primitives, and returns
`None` rather than raising when something is absent — deciding that a missing row is a 404
is the service's job, not the repository's.

Forbidden here: business rules, HTTP concepts, Pydantic schemas.

### `app/models/` and `app/schemas/`

Two separate type families that happen to look alike. Never collapse them. Models describe
storage, schemas describe the wire. A schema that reads from an ORM object sets
`model_config = ConfigDict(from_attributes=True)`.

Split schemas by intent, not by entity alone: `ConsultationCreate` (what the client may
send), `ConsultationRead` (what we return). A create schema must not accept `id` or
`created_at` — accepting client-supplied identifiers is how mass-assignment bugs start.

### `app/core/`

`config.py` (Pydantic `BaseSettings`, single `settings` instance, read from `.env`),
`database.py` (engine, `SessionLocal`, `get_db` generator dependency), `exceptions.py`
(domain exception hierarchy), `security.py` (JWT — only if the optional auth feature is built).

### Target layout

```
backend/
├── app/
│   ├── main.py                 app factory, router mounting, exception handlers, CORS
│   ├── core/                   config.py  database.py  exceptions.py  security.py
│   ├── models/                 diagnosis.py  consultation.py
│   ├── schemas/                diagnosis.py  consultation.py
│   ├── repositories/           diagnosis.py  consultation.py
│   ├── services/               diagnosis.py  consultation.py
│   ├── api/
│   │   ├── deps.py             get_db, get_current_doctor
│   │   └── v1/                 diagnosis.py  consultation.py  router.py
│   └── scripts/seed.py
├── migrations/                 alembic
├── seeds/icd10_seed.sql        100 real ICD-10 codes
└── tests/                      conftest.py  unit/  integration/
```

`backend/main.py` (the `uv init` placeholder) gets deleted once `app/main.py` exists.

## Data model

Three tables. Keep it there.

`diagnosis_codes` — `code` (TEXT PK, e.g. `E11.9`), `description` (TEXT NOT NULL). Static
reference data, populated from `seeds/icd10_seed.sql`, never written at runtime.

`consultations` — `id` (INTEGER PK), `patient_name` (TEXT NOT NULL, indexed),
`notes` (TEXT), `created_at` (TIMESTAMP NOT NULL, server default).

`consultation_diagnoses` — join table, `consultation_id` + `diagnosis_code` composite PK,
both FK, `ON DELETE CASCADE` from consultation. `diagnosis_code` is also indexed on its
own: the composite PK only serves lookups that lead with `consultation_id`, and the list
endpoint's `?code=` filter leads with the code.

The assignment has no Patient entity — `patient_name` is a plain indexed string. Do not
invent a `patients` table. If the optional JWT feature is built, add `doctors`
(`id`, `email` unique, `hashed_password`) and an optional `doctor_id` FK on `consultations`.

SQLite specifics: foreign keys are **off** by default — enable `PRAGMA foreign_keys=ON`
per connection in `database.py`. Search uses `LIKE` with `COLLATE NOCASE`; do not reach
for FTS5 or a search engine.

## Request flow

Creating a consultation, end to end:

```
POST /api/v1/consultations
  → api/v1/consultation.py      validates ConsultationCreate, Depends(get_db)
  → services/consultation.py    verifies every submitted code exists
                                (ValidationError if not), builds the ORM graph, commits
  → repositories/consultation.py   insert + join rows
  → returns ConsultationRead (201)
```

Searching diagnoses: `GET /api/v1/diagnoses?search=diab&limit=20` → service normalises the
term (strip, lowercase, reject empty) → repository runs a `LIKE` over `code` and
`description` → returns a capped list. Always cap; never return the full table.

Listing consultations: `GET /api/v1/consultations?patient=&code=&limit=&offset=` — one
endpoint serves both the list page and the search page. Do not build a second search
endpoint for the third page.

## Frontend structure

Nuxt 3 layout, root-level directories:

```
frontend/
├── app.vue
├── nuxt.config.ts              runtimeConfig.public.apiBase
├── pages/
│   ├── index.vue               → redirect to /consultations
│   ├── consultations/index.vue list
│   ├── consultations/new.vue   create form
│   └── search.vue              search + results
├── components/
│   ├── consultation/           ConsultationTable.vue  ConsultationForm.vue
│   ├── diagnosis/              DiagnosisSearchSelect.vue
│   └── ui/                     BaseInput.vue  BaseButton.vue …
├── composables/                useApi.ts  useConsultations.ts  useDiagnoses.ts
└── types/api.ts
```

Three layers with the same one-way rule: `pages → composables → useApi`. Pages own route
state and layout. Components are presentational — props in, events out, no data fetching.
Composables own every call to the backend.

`useApi.ts` is the single place that knows the base URL, default headers, the auth token
(if built), and how to turn an error envelope into a thrown error. Every other composable
goes through it.

State: `useState` for anything shared across pages. Do not add Pinia for three pages.

## Boundaries, stated plainly

- The frontend never talks to SQLite, and `server/` in Nuxt stays unused — it is not a proxy.
- The backend never renders HTML and never knows a page exists.
- ORM objects never cross the API boundary; Pydantic schemas never reach a repository.
- Domain exceptions never cross the API boundary; handlers in `main.py` translate them
  into the error envelope described in `coding-standards.md`.
