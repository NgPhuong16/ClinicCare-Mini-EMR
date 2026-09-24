# ClinicCare Mini EMR

Minimal EMR. Doctors search ICD-10 codes, record a consultation note against one or more
codes, and list/search past notes. Two apps, one git repo: `backend/` (FastAPI + SQLite)
and `frontend/` (Nuxt 3). No shared package, no monorepo tooling — they talk over HTTP only.

Grading note: the commit history is part of the deliverable. Commit in small, working,
logically-scoped steps. Never squash a feature into one giant commit.

## Stack — fixed, do not change without asking

| Layer    | Choice                                                            |
| -------- | ----------------------------------------------------------------- |
| Backend  | FastAPI, Python >= 3.14, package manager **uv** (never `pip`)     |
| DB       | **SQLite** + SQLAlchemy 2.0 (sync) + Alembic                      |
| Frontend | **Nuxt 3** (3.21.x), Vue 3, TypeScript, **pnpm** (never npm/yarn) |
| Tests    | pytest + httpx (backend), Vitest (frontend)                       |

Frontend is Nuxt **3**, deliberately downgraded from 4. It uses the Nuxt 3 layout
(root-level `pages/`, `components/`, `composables/`) — **not** the Nuxt 4 `app/` directory.

## Commands

Backend — run from `backend/`:

```bash
uv sync                                   # install deps from uv.lock
uv add <pkg>            / uv add --dev <pkg>
uv run fastapi dev app/main.py            # dev server :8000
uv run pytest -q                          # all tests
uv run pytest tests/unit -q               # unit only
uv run ruff check . --fix && uv run ruff format .
uv run mypy app
uv run alembic revision --autogenerate -m "msg"
uv run alembic upgrade head               # apply migrations
uv run python -m app.scripts.seed         # load seeds/icd10_seed.sql + demo doctor
```

Frontend — run from `frontend/`:

```bash
pnpm install
pnpm dev                                  # :3000
pnpm build && pnpm preview
pnpm typecheck                            # nuxt typecheck (vue-tsc under the hood)
pnpm lint --fix                           # eslint . --fix
pnpm test                                 # vitest run
```

Never run a command from the repo root — every command belongs to one of the two apps.

## Architecture rules (summary)

Backend layering, strictly one direction — `api → services → repositories → models`:

- `app/api/` — routing, HTTP status, `Depends`. No SQLAlchemy, no business rules.
- `app/services/` — business logic. Raises domain exceptions, never `HTTPException`.
- `app/repositories/` — all DB access. Returns ORM objects. Knows nothing about HTTP.
- `app/models/` — SQLAlchemy ORM. `app/schemas/` — Pydantic v2 request/response.

ORM models and Pydantic schemas are separate types. Never return an ORM object from a
route; convert through a response schema.

Frontend: pages render, components present, **composables own all HTTP**. A `.vue` file
never calls `$fetch`/`useFetch` against the API directly — it calls a composable in
`composables/`. API base URL comes from `runtimeConfig.public.apiBase`, never a literal.

API payloads are `snake_case` on both sides. Do not add a camelCase mapping layer.

## Critical don'ts

- Don't use `pip`, `python -m venv`, `npm`, or `yarn`. Only `uv` and `pnpm`.
- Don't bump or loosen a version in `pyproject.toml` / `package.json` to fix an error.
  Especially: do not "upgrade" Nuxt back to 4.
- Don't create `frontend/app/` — that is the Nuxt 4 layout and will silently break routing.
- Don't write Pydantic v1 syntax: no `@validator`, `.dict()`, `.json()`, `orm_mode`.
  Use `@field_validator`, `.model_dump()`, `model_config = ConfigDict(from_attributes=True)`.
- Don't write SQLAlchemy 1.x syntax: no `session.query(...)`. Use `select()` + `session.execute()`.
- Don't declare a DB route as `async def`. The session is sync; `async def` blocks the
  event loop. Use plain `def` and let FastAPI's threadpool handle it.
- Don't invent ICD-10 codes. Codes and descriptions in the seed file must be real.
- Don't catch a bare `Exception` to make an error go away, and don't return HTTP 200 on failure.
- Don't hardcode secrets or the API URL. Config goes through Pydantic `Settings` / `runtimeConfig`.
- Don't commit `*.db`, `.venv/`, `node_modules/`, `.nuxt/`, `.env`.
- Don't add a dependency for something the stdlib or an existing dep already does.

## Detailed rules — read on demand

These are deliberately kept out of this file to save context. Read the one you need,
when you need it:

- `.claude/rules/architecture.md` — layer contracts, module boundaries, data flow,
  directory layout. Read before adding a module, an endpoint, or a page.
- `.claude/rules/coding-standards.md` — naming, Pydantic/SQLAlchemy/FastAPI idioms,
  Vue/Nuxt conventions, error envelope. Read before writing non-trivial code.
- `.claude/rules/testing.md` — test layout, fixtures, mocking policy, what to cover.
  Read before writing or changing tests.

Slash commands available: `/seed-icd10`, `/new-endpoint`, `/precommit` — see `.claude/commands/`.

## Decisions

Append-only log of project-level calls, so they persist across sessions instead of living
only in chat history. Add an entry when a change picks one option over a named
alternative, guards against a failure the code doesn't make obvious, sets a convention
later code should follow, or narrows something the assignment left open — not for routine
work, since an over-full log stops being read. Write it with `/log-decision`, and stage
`CLAUDE.md` in the same commit as the code it explains; a `git commit` hook asks about it
whenever architecture-bearing files change without `CLAUDE.md`. Format: date, decision,
one clause of why. Don't relitigate an entry without a new reason.

- 2026-09-21 — Frontend is **Nuxt 3** (3.21.x), not 4. Matches the assignment brief exactly;
  initial scaffold was Nuxt 4 and was deliberately downgraded.
- 2026-09-21 — Database is **SQLite**, not PostgreSQL. Lightest option that satisfies
  "lightweight SQL DB"; no server process needed for a take-home-sized project.
- 2026-09-21 — **mypy is the source of truth** for type correctness (`uv run mypy app`
  gates commits). pyright/Pylance in the editor is live feedback only; on disagreement,
  mypy wins.
- 2026-09-21 — Dropped the standalone `pyright` (backend) and `typescript-language-server`
  (frontend) devDependencies. VS Code's Pylance and Volar don't call either binary directly,
  and the project is small enough that the extra pinned dependency isn't worth carrying.
  Kept `typescript` itself, since `typescript.tsdk` in `.vscode/settings.json` does use it.
- 2026-09-21 — No `patients` table. The assignment doesn't specify a Patient entity;
  `consultations.patient_name` is a plain indexed string.
- 2026-09-22 — `app/models/__init__.py` imports its sibling modules by discovery
  (`pkgutil.iter_modules`) instead of listing them by hand. Alembic's `env.py` relies on
  `import app.models` to populate `Base.metadata`, and a model missing from a hand-written
  list yields a silently empty migration. Do not "simplify" this back to explicit imports.
- 2026-09-22 — Domain-exception status is resolved by walking `type(exc).__mro__` in
  `main.py`, not by exact-type lookup, so a subclass inherits its parent's status
  (`DiagnosisNotFoundError(NotFoundError)` → 404). Services may subclass freely; a
  regression test in `tests/integration/test_error_envelope.py` guards this.
- 2026-09-22 — ICD-10 seed data comes from the NLM Clinical Tables API
  (`clinicaltables.nlm.nih.gov/api/icd10cm/v3/search`), not icd10data.com. icd10data.com
  answers 403 to non-browser fetches, and the NLM API returns exact `(code, name)` JSON, so
  the seed is copied verbatim rather than passed through a summariser. Regenerate from
  the API; do not re-type codes by hand.
- 2026-09-22 — No hard-delete endpoint for `consultations` is planned; the
  `ON DELETE CASCADE` on `consultation_diagnoses` is a DB-integrity safeguard, not a
  user-facing feature. If a "remove consultation" flow is added later, implement it as soft-delete
  (`deleted_at`), not a real `DELETE` — these are clinical records.
- 2026-09-22 — Diagnosis search escapes LIKE wildcards (`%`, `_`, `\`) in the repository
  before building the pattern. Without it `?search=%` matches every row and defeats the
  blank-term guard. Any future `LIKE` on user input must escape the same way.
- 2026-09-22 — An out-of-range `limit` (0 or > 100) is rejected with 422 via
  `Query(ge=1, le=100)`, not silently clamped. Keeps the constraint in the field per
  coding-standards and makes a bad client visible; do not "soften" this to clamping.
- 2026-09-23 — A consultation's attached `diagnoses` are always returned in **code order**,
  never submission order, so POST and GET agree. `expire_on_commit=False` means POST returns
  the in-memory list it built, while GET reloads through
  `relationship(order_by=DiagnosisCode.code)` — so `create()` sorts before writing. Remove
  that sort and the same record lists its codes differently just-created vs looked-up.
- 2026-09-23 — The `db` fixture in `tests/conftest.py` sets `expire_on_commit=False` to match
  `SessionLocal` exactly. With the default `True`, committed objects reload on access and
  tests observe ordering the deployed app never produces — that masked the POST/GET
  disagreement above. Keep any new session fixture in sync with `database.py`.
- 2026-09-23 — Frontend `typescript` is pinned `~6.0.3`, not `^7`. TS 7's native build drops
  the JS API that `vue-tsc` (Volar) resolves as `typescript/lib/tsc` and that
  `@typescript-eslint/parser` requires (it peers `>=4.8.4 <6.1.0` and throws outright on
  7.0) — under TS 7 both `pnpm lint` and `pnpm typecheck` fail to start. 6.0 is the last
  JS-based release. Tilde, not caret, so it cannot drift to 6.1+. Revisit when vue-tsc and
  typescript-eslint support TS 7; do not "upgrade" it back before then.
- 2026-09-23 — `unrs-resolver` is `false` in `frontend/pnpm-workspace.yaml`'s `allowBuilds`,
  alongside `esbuild`. Its native binding ships as an optional platform package
  (`@unrs/resolver-binding-*`), so the postinstall is unnecessary — but leaving it
  unanswered makes pnpm exit 1 on *every* `pnpm <script>`, not just install.
- 2026-09-23 — The composables' error contract, which the pages are written against. Every
  failure reaches the UI as an `ApiError` carrying the backend's `code` and `message`, so a
  page parses one shape. `search()` and `list()` report through their `error` ref and never
  throw — they back a live-updating list, where a rejected promise per keystroke is noise.
  `create()` sets `error` **and** rethrows, because a form must know its submit failed
  rather than watch a ref. Anything without a recognisable envelope (unreachable backend,
  a proxy's HTML error page) becomes `NETWORK_ERROR`, so no raw fetch error leaks to a user.
- 2026-09-23 — In `useDiagnoses.search` and `useConsultations.list`, only the most recent
  call may write `results`/`items`, `error` and `pending`; each instance keeps a request
  counter and drops late responses, and `reset()` invalidates anything in flight. Search
  fires per debounced keystroke, so "e1" can settle after "e11" and overwrite the newer
  matches while the input still reads "e11" — debouncing makes that rarer, not impossible.
  `create()` is deliberately exempt: one submit, result returned to the caller.
- 2026-09-23 — `consultations.created_at` is stored **naive UTC** (SQLite has no timezone
  type and `CURRENT_TIMESTAMP` is UTC) and a `@field_validator` on `ConsultationRead`
  attaches UTC on the way out, so the JSON always carries an explicit offset — Pydantic
  emits it as a trailing `Z`, e.g. `2026-09-01T09:00:00Z`. Without it the wire value has no
  offset and a client is free to read it as local time. Fix this in the schema, not by
  changing the column; clients must never assume local time.
- 2026-09-23 — SSR stays **on**. Page-load data (the consultations list) goes through a
  keyed, `lazy` `useAsyncData` wrapped in a composable (`useConsultationList`), never in a
  `.vue`; `lazy` so a NuxtLink navigation switches page and shows the loading state instead
  of freezing on the previous page, while a hard load still renders server-side.
  User-triggered data (diagnosis search, search filters, create) keeps using the
  browser-side `search()`/`list()`/`create()`. The handler **returns** its failure as a
  plain `{ code, message }` rather than throwing: `useAsyncData` would wrap a thrown error,
  and an `ApiError` class instance does not survive payload serialisation, so the client
  would see a different shape from the server. Verified in Nuxt 3.21's source that the
  default `getCachedData` reads `payload.data` only while hydrating and `static.data`
  (empty outside prerendering) otherwise, so a cross-route client navigation refetches and
  a newly created consultation appears without an explicit `refresh()`. Note the same-route
  case is different: clicking a link to the page you are already on is a router no-op, the
  component never remounts, and nothing refetches.
- 2026-09-23 — The server never formats a local time. It cannot know the viewer's zone, so
  printing one would hydrate into a mismatch and show the *server's* zone to everyone.
  Timestamps render through Nuxt's built-in `<NuxtTime>` (confirmed present in 3.21.11):
  it emits a semantic `<time datetime="<ISO UTC>">`, and an `onPrehydrate` script rewrites
  the text in the browser's zone *before* Vue hydrates, so there is no mismatch. Never pass
  a `timeZone` prop and never hardcode a zone — verified live rendering `…T15:54:55.000Z`
  as `10:54 PM` in `Asia/Saigon`.
- 2026-09-24 — The search page's diagnosis-code filter is **picked from diagnosis search
  results** (`DiagnosisSearchSelect` with `maxCodes: 1`), never typed free-hand. The
  backend's `?code=` is an exact match, so a typed prefix like `E11` silently returns
  nothing while looking like a working search. Do not "simplify" this into a free-text box.
  The patient filter is the opposite — a `LIKE` substring — and stays a plain input.
- 2026-09-24 — Optional JWT auth (milestone 7) adds a `doctors` table (email unique +
  indexed, hashed_password), no `doctor_id` FK on consultations yet. Passwords are hashed
  with stdlib `hashlib.scrypt` into a self-describing `scrypt$n$r$p$salt$hash` string,
  verified with `hmac.compare_digest` — no passlib, per this file's "no dependency for
  something the stdlib already does". The seed script also idempotently creates a demo
  doctor (`doctor@cliniccare.local`) from `Settings.demo_doctor_password`, which has a
  documented, non-secret default: it's a public demo credential meant to be printed in the
  README for graders, not a real secret, so it does not need `.env`-only handling.
- 2026-09-24 — `ruff format` emits PEP 758 unparenthesised `except A, B:` clauses, which is
  valid syntax because the project requires Python >=3.14 (PEP 758 landed in 3.14). Do not
  "fix" it back to parentheses and do not drop `ruff format` from the workflow. Parentheses
  are still required when the except clause uses `as`.
- 2026-09-24 — JWT signing/verification uses **PyJWT**, not a hand-rolled implementation.
  Token signing is security code the stdlib doesn't provide, unlike password hashing
  (`hashlib.scrypt` already covers that) — this is not a "no dependency for what the stdlib
  does" violation, it's a different kind of primitive.
- 2026-09-24 — Auth sessions are **cookie-only** (httponly, `SameSite=Lax`), never a
  Bearer-header path: `/docs` is same-origin with the API, so the cookie works there too,
  and there's no second flow to keep in sync. `Settings.jwt_secret` has no hardcoded
  default — an unset one is generated with `secrets.token_urlsafe` at startup and logged as
  a warning, so a fresh clone runs with zero config at the cost of every doctor being logged
  out on restart. Set `JWT_SECRET` in `.env` to avoid that trade-off.
- 2026-09-24 — Only the **consultations** router carries the `get_current_doctor`
  dependency; **diagnoses** stays public. Consultations are patient records; ICD-10 lookup
  is static reference data with no patient information in it, so gating it behind login
  would add friction without protecting anything.
- 2026-09-24 — `LoginRequest.email` is a plain `str`, not Pydantic's `EmailStr`. `EmailStr`
  rejects `doctor@cliniccare.local` as a "special-use or reserved name", and a format check
  adds nothing on login — a malformed address just fails to match on lookup like any other
  unknown email, and `authenticate()` gives both the same "Invalid email or password".

## Project state

Backend is feature-complete for the assignment's two entities. Foundation: `app/` package
with `Settings`, `database.py` (engine, `get_db`, SQLite FK pragma), domain exceptions,
error-envelope handlers and `/health`; `.env.example` and a backend `README.md`.
`DiagnosisCode`, `Consultation` and the `consultation_diagnoses` join table are defined,
with one Alembic revision in `migrations/versions/` creating all three, and
`seeds/icd10_seed.sql` holding 100 real ICD-10-CM codes loaded by
`python -m app.scripts.seed`. Milestone 7 (in progress) has added a `doctors` table
(`app/models/doctor.py`), password hashing and JWT signing in `app/core/security.py`
(stdlib `hashlib.scrypt`, PyJWT), and a demo doctor account idempotently seeded alongside
the ICD-10 codes. Cookie-based auth is live: `POST /api/v1/auth/login`, `/logout` and
`GET /me` (`app/api/v1/auth.py`, `app/services/auth.py`), and `get_current_doctor`
(`app/api/deps.py`) protects every `/api/v1/consultations` route — `/api/v1/diagnoses`
stays public. The frontend login page and route guard are still to come.

Both entities are built through every layer (schemas, repositories, services, routes):
`GET /api/v1/diagnoses?search=&limit=` searches code and description
case-insensitively, and `POST /api/v1/consultations` plus
`GET /api/v1/consultations?patient=&code=&limit=&offset=` create and list consultations.
`tests/` covers both through `TestClient` against in-memory SQLite, plus unit tests for the
schema validators and the search-term normaliser. `uv run pytest -q`, `uv run mypy app` and
`uv run ruff check .` are green.

Frontend tooling is installed: `@nuxt/eslint` + `eslint` (wired through
`eslint.config.mjs`), `vue-tsc` via `nuxt typecheck`, and `vitest` + `@vue/test-utils` +
`@nuxt/test-utils` + `happy-dom` (`vitest.config.ts`, Nuxt environment). `pnpm lint`,
`pnpm typecheck` and `pnpm test` all pass. `@nuxt/test-utils` is held at the **3.x** line —
4.x peers on `h3-next` (h3 v2) and is Nuxt 4 only — which in turn caps `vitest` at 3.x.

The API client is in place: `runtimeConfig.public.apiBase` (default
`http://localhost:8000/api/v1`, overridable via `NUXT_PUBLIC_API_BASE`, documented in
`.env.example`); `types/api.ts` mirroring the backend schemas by hand; `composables/`
with `useApi.ts` (the only holder of the base URL, unwraps the error envelope into a
thrown `ApiError`, falls back to `NETWORK_ERROR`), `useDiagnoses.ts` and
`useConsultations.ts`; `layouts/default.vue` with the nav, and `app.vue` rendering
`<NuxtLayout><NuxtPage /></NuxtLayout>`.

All three pages exist. `pages/index.vue` redirects to `/consultations`;
`pages/consultations/index.vue` lists newest-first via `useConsultationList` (keyed, lazy
`useAsyncData`); `pages/consultations/new.vue` owns `create()` and diagnosis search and
navigates to the list on success; `pages/search.vue` filters by patient substring and/or
an exactly-matched diagnosis code through the browser-side `list()`. Every page shows
loading, empty and error states, and search distinguishes "no filter yet" from "no
matches".

`components/` holds `consultation/ConsultationTable.vue`, `consultation/ConsultationForm.vue`
and `diagnosis/DiagnosisSearchSelect.vue` (debounced search, multi-select on the form and
single-select at `maxCodes: 1` on the search page). Components are presentational — props
in, events out — and every call to the backend still goes through a composable.

Tests: **64** across `tests/` (composables and the new-consultation page, `$fetch` stubbed)
and `*.spec.ts` beside each component. `pnpm lint`, `pnpm typecheck` and `pnpm test` are
green. No `components/ui/` yet; the assignment's three pages did not need shared inputs or
buttons, so styling lives in each component's scoped CSS.
