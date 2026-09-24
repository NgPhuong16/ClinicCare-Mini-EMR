# ClinicCare Mini EMR

A minimal EMR for a clinic front desk. A doctor searches ICD-10-CM diagnosis codes,
records a consultation note against one or more of them, and lists or searches past
consultations. Two apps in one repo — `backend/` (FastAPI + SQLite) and `frontend/`
(Nuxt 3) — talking over HTTP only.

**Implemented, per the brief:**

- Search ICD-10 diagnosis codes by code or description.
- Record a consultation note against one or more selected diagnosis codes.
- List past consultations, newest first.
- Search consultations by patient name and/or diagnosis code.

**Also implemented (optional):** JWT-based login for doctors, with every consultation
route behind a session cookie.

## Prerequisites

- [uv](https://docs.astral.sh/uv/getting-started/installation/) — manages the backend's
  Python environment. Python **3.14** is pinned in `backend/.python-version`; uv fetches
  that exact interpreter itself on first `uv sync`, so you don't need Python installed
  separately.
- [pnpm](https://pnpm.io/installation) — manages the frontend. Nuxt 3.21 requires Node
  `^20.19.0 || >=22.12.0` (from `nuxt`'s own `package.json` `engines` field); pnpm will
  warn if your Node is older.

## Quick start

From a fresh clone, in **two terminals**.

**Terminal 1 — backend:**

```bash
cd backend
uv sync                                # install dependencies (fetches Python 3.14 too)
uv run alembic upgrade head            # create the SQLite schema
uv run python -m app.scripts.seed      # load 100 ICD-10 codes + the demo doctor
uv run fastapi dev app/main.py         # http://localhost:8000 (docs at /docs)
```

**Terminal 2 — frontend:**

```bash
cd frontend
pnpm install
pnpm dev                               # http://localhost:3000
```

Open **http://localhost:3000** — use `localhost`, not `127.0.0.1`, or the browser won't
send the login cookie back (it's scoped to the domain that set it; see Authentication
below). Log in with:

```
email:    doctor@cliniccare.local
password: changeme123
```

Both apps run with zero configuration — `.env` files are entirely optional, every
setting has a working default. The one trade-off: without `JWT_SECRET` set, the backend
generates a random signing key each time it starts, so **restarting the backend logs
every doctor out**. Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET`
to avoid that during a longer session.

## Configuration

### Backend (`backend/.env`, see `backend/.env.example`)

| Setting                       | Env var                       | Default                              | What it does                                                        |
| ------------------------------ | ------------------------------ | ------------------------------------- | --------------------------------------------------------------------- |
| `app_name`                    | `APP_NAME`                    | `ClinicCare Mini EMR`                | Title shown in the OpenAPI docs at `/docs`.                          |
| `debug`                       | `DEBUG`                       | `false`                              | FastAPI debug mode.                                                  |
| `database_url`                | `DATABASE_URL`                | `sqlite:///./cliniccare.db`          | SQLAlchemy connection string.                                        |
| `cors_origins`                | `CORS_ORIGINS`                | `["http://localhost:3000"]`          | Origins allowed to call the API with credentials.                    |
| `demo_doctor_password`        | `DEMO_DOCTOR_PASSWORD`        | `changeme123`                        | Password for the seeded demo doctor — a public demo credential, not a secret. |
| `jwt_secret`                  | `JWT_SECRET`                  | random per process (≥32 chars if set) | HMAC key signing session JWTs. Unset means sessions don't survive a restart. |
| `access_token_expire_minutes` | `ACCESS_TOKEN_EXPIRE_MINUTES` | `60`                                  | Minutes before a login session (and its cookie) expires.             |
| `auth_cookie_name`            | `AUTH_COOKIE_NAME`            | `access_token`                       | Name of the cookie carrying the session JWT.                         |
| `cookie_secure`               | `COOKIE_SECURE`               | `false`                              | Send the cookie only over HTTPS. Keep `false` for local http dev.    |

### Frontend (`frontend/.env`, see `frontend/.env.example`)

| Setting                 | Default                          | What it does                                                    |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------ |
| `NUXT_PUBLIC_API_BASE`  | `http://localhost:8000/api/v1`    | Base URL of the backend API (`runtimeConfig.public.apiBase`).    |

## API

| Method | Path                     | Auth required | Purpose                                                |
| ------ | ------------------------ | :-----------: | ------------------------------------------------------- |
| GET    | `/health`                | No            | Liveness check.                                        |
| POST   | `/api/v1/auth/login`     | No            | Verify email + password; sets the session cookie.      |
| POST   | `/api/v1/auth/logout`    | No            | Clears the session cookie.                              |
| GET    | `/api/v1/auth/me`        | Yes           | Returns the current signed-in doctor.                  |
| GET    | `/api/v1/diagnoses`      | No            | Search ICD-10-CM codes: `?search=<term>&limit=`.       |
| POST   | `/api/v1/consultations`  | Yes           | Record a consultation against one or more diagnosis codes. |
| GET    | `/api/v1/consultations`  | Yes           | List/search consultations: `?patient=&code=&limit=&offset=`. |

**Differences from the brief.** The brief's `/diagnosis` and `/consultation` are
implemented as plural REST resources under a versioned prefix — `GET /api/v1/diagnoses`
and `POST`/`GET /api/v1/consultations` — rather than singular unversioned paths. ICD-10
data comes from the [NLM Clinical Tables API](https://clinicaltables.nlm.nih.gov/) rather
than icd10data.com, which answers 403 to non-browser requests; the 100 seeded codes are
real ICD-10-CM `(code, description)` pairs copied verbatim from that API (see CLAUDE.md's
Decisions log for the full reasoning).

## Validation & errors

Requests are validated by Pydantic v2 at the schema layer (field constraints, blank-string
rejection, code-list dedup, etc.) before a service ever runs. Every failure — a domain
error, a Pydantic validation error, an unknown route, or an unhandled exception —
comes back in the same envelope, so the frontend parses one shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "body.patient_name", "message": "String should have at least 1 character" }]
  }
}
```

Status codes used: `401` (not authenticated / bad credentials), `404` (not found),
`409` (conflict), `422` (validation), `500` (unexpected error). `details` is only present
for field-level validation failures.

## Authentication

Login is cookie-only: `POST /api/v1/auth/login` verifies email + password and sets an
httpOnly, `SameSite=Lax` JWT cookie (PyJWT, HS256) — the token itself never appears in a
response body, so client-side JavaScript can't read it either. Passwords are hashed with
the stdlib's `hashlib.scrypt`, not a third-party library. Every `/api/v1/consultations`
route requires a valid session cookie; `/api/v1/diagnoses` stays public, since ICD-10
codes are reference data, not a patient record. On the frontend, server-side rendering
forwards only the browser's `cookie` header to the backend, so a hard-loaded page already
knows who's signed in before any client-side JavaScript runs.

## Project structure

```
ClinicCare-Mini-EMR/
├── backend/
│   ├── app/
│   │   ├── api/            routing — request/response schemas, Depends, one service call per route
│   │   ├── core/            settings, DB engine, domain exceptions, password/JWT helpers
│   │   ├── models/          SQLAlchemy ORM: DiagnosisCode, Consultation, Doctor
│   │   ├── repositories/    all DB access — every select/insert/update/delete
│   │   ├── schemas/         Pydantic v2 request/response models
│   │   ├── services/        business logic; raises domain exceptions, never HTTPException
│   │   └── scripts/         seed.py — loads ICD-10 codes + the demo doctor
│   ├── migrations/          Alembic revisions
│   ├── seeds/                icd10_seed.sql — 100 real ICD-10-CM codes
│   └── tests/                unit/ + integration/, pytest + httpx against in-memory SQLite
└── frontend/
    ├── pages/                routes: consultations list/new, search, login
    ├── components/           presentational Vue components — props in, events out
    ├── composables/          all HTTP calls: useApi, useAuth, useConsultations, useDiagnoses
    ├── middleware/            auth.global.ts — the route guard
    ├── layouts/               default.vue — nav plus signed-in doctor / log out
    ├── utils/                 small pure helpers (safeRedirect)
    ├── types/                 hand-mirrored backend schemas
    └── tests/                 Vitest specs beside composables/pages, *.spec.ts beside components
```

## Testing & quality

```bash
cd backend
uv run pytest -q            # 91 passed
uv run ruff check .         # All checks passed!
uv run ruff format --check .
uv run mypy app              # Success: no issues found in 35 source files
```

```bash
cd frontend
pnpm test                    # 91 passed (12 test files)
pnpm lint
pnpm typecheck
```

Counts as of this submission — run the commands yourself to reconfirm.

## Design decisions

The most important calls this project makes; see **CLAUDE.md → Decisions** for the full,
dated log with each one's reasoning.

- Frontend is Nuxt **3** (not 4), matching the assignment brief exactly.
- Database is **SQLite**, the lightest option that satisfies "a lightweight SQL DB."
- ICD-10 seed data comes from the **NLM Clinical Tables API**, not icd10data.com (which
  403s non-browser requests) — all 100 codes are real ICD-10-CM.
- Consultations have **no edit or delete endpoint**; they're clinical records, meant to
  be append-only.
- Auth is **cookie-only** (httpOnly, `SameSite=Lax`) — no Bearer-token path to keep in
  sync, and it works for `/docs` too since it's same-origin with the API.
- Passwords use stdlib **`hashlib.scrypt`**; sessions use **PyJWT** — hashing and signing
  are different primitives, so the stdlib-only rule applies to one but not the other.
- `JWT_SECRET` has **no hardcoded default**: unset, one is generated and validated
  (≥32 characters) at startup, so a bad or blank secret fails fast instead of 500-ing.
- Server-side rendering forwards **only the `cookie` header**, never every incoming
  header, when relaying a request to the backend.

## Known limitations

- One seeded demo doctor (`doctor@cliniccare.local`); no self-registration or doctor
  management UI.
- Consultations aren't linked to the doctor who recorded them (no `doctor_id` column) —
  any signed-in doctor sees every consultation.
- Without `JWT_SECRET` set, a backend restart logs every doctor out (see Quick start).
- SQLite only; no other database backend is supported.
- No edit or delete for consultations. If a "remove" flow is ever added it should
  soft-delete (`deleted_at`), not issue a real `DELETE` — these are clinical records.
- The 100 seeded diagnosis codes are a subset, not the full ICD-10-CM catalog.
- No password reset flow, and no rate limiting on login beyond scrypt's own cost.

---

The commit history reflects the actual development steps (backend layers, then frontend
pages, then optional auth) rather than one squashed commit — see `git log`.
