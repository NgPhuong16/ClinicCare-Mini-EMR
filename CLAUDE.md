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
uv run python -m app.scripts.seed         # load seeds/icd10_seed.sql
```

Frontend — run from `frontend/`:

```bash
pnpm install
pnpm dev                                  # :3000
pnpm build && pnpm preview
pnpm typecheck                            # vue-tsc
pnpm lint --fix
pnpm test                                 # vitest
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

Append-only log of project-level calls made outside the assignment doc, so they persist
across sessions instead of living only in chat history. When you (agent or human) settle
something during implementation that isn't already covered above, add one line here —
date, decision, one-clause reason. Don't relitigate an entry without a new reason.

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

## Project state

Backend foundation is in place: `app/` package with `Settings`, `database.py` (engine,
`get_db`, SQLite FK pragma), domain exceptions, error-envelope handlers and `/health`;
Alembic initialised (`migrations/`, URL read from `Settings`); pytest fixtures in
`tests/conftest.py`. No models, schemas, repositories, services or business endpoints yet —
those packages exist but are empty. `.env.example` is still to be written by hand.

Frontend is still a scaffold: `app.vue` only, no pages, and the lint/test/typecheck scripts
are **not installed yet**; add them with `pnpm add -D` on first use, then update this file
if a command changes.
