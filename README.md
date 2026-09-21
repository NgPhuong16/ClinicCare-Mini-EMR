# ClinicCare Mini EMR

A minimal tool for clinics to record and search patient consultation notes against
ICD-10 diagnosis codes.

**Status:** scaffolding — backend and frontend are set up, application code is in progress.

## Stack

- **Backend:** FastAPI (Python 3.14+), SQLAlchemy 2.0 + SQLite, Alembic migrations,
  managed with [uv](https://docs.astral.sh/uv/).
- **Frontend:** Nuxt 3, Vue 3, TypeScript, managed with [pnpm](https://pnpm.io/).

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [pnpm](https://pnpm.io/installation)

## Setup & run

### Backend (`backend/`)

```bash
cd backend
uv sync                          # install dependencies
uv run alembic upgrade head      # create the database schema
uv run python -m app.scripts.seed   # load 100 ICD-10 diagnosis codes
uv run fastapi dev app/main.py   # start the API at http://localhost:8000
```

Interactive API docs: http://localhost:8000/docs

### Frontend (`frontend/`)

```bash
cd frontend
pnpm install
pnpm dev                         # start the app at http://localhost:3000
```

The frontend expects the backend at `http://localhost:8000` by default
(`runtimeConfig.public.apiBase` in `frontend/nuxt.config.ts`).

## API

| Method | Path                    | Description                                     |
| ------ | ----------------------- | ----------------------------------------------- |
| GET    | `/api/v1/diagnoses`     | Search ICD-10 codes: `?search=<term>&limit=`    |
| POST   | `/api/v1/consultations` | Create a consultation note with diagnosis codes |
| GET    | `/api/v1/consultations` | List/search consultations: `?patient=&code=`    |

## Project structure

```
kyanon/
├── backend/     FastAPI app, SQLite DB, migrations, seed data
└── frontend/    Nuxt 3 app — consultations list, new consultation form, search
```

See `CLAUDE.md` and `.claude/rules/` for the detailed architecture, coding conventions,
and testing strategy this project follows.

## Testing

```bash
cd backend  && uv run pytest
cd frontend && pnpm test
```

## Notes

- Diagnosis codes are real ICD-10-CM codes (a 100-code subset), not generated data.
- JWT authentication for doctors is an optional feature; see `CLAUDE.md` for its status.
