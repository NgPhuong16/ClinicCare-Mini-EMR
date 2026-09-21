# Coding standards

Read before writing non-trivial code. Conventions only — layer rules live in `architecture.md`.

## Python

Target 3.14. Ruff is the formatter and linter; line length 100. Use built-in generics
(`list[str]`, `dict[str, int]`, `X | None`) — never `typing.List`, never `Optional[X]`.

Naming: modules and functions `snake_case`, classes `PascalCase`, constants `UPPER_SNAKE`,
private helpers `_leading_underscore`. Module names are singular and match the entity
(`consultation.py`, not `consultations.py` or `consultation_service.py` — the directory
already says which layer it is).

Every function that crosses a layer boundary is fully type-annotated, arguments and return.
No bare `Any`. No mutable default arguments.

Imports are absolute from `app` (`from app.services import consultation`). No relative
imports beyond `.` within a package, no star imports, no imports inside functions except
to break a genuine cycle — and a cycle usually means a layer was violated.

Docstrings only where the _why_ is non-obvious. Do not docstring `get_by_id`. Never leave
a commented-out block behind; delete it, git remembers.

## Pydantic v2

v2 syntax only. `@field_validator` / `@model_validator`, `.model_dump()`, `.model_validate()`,
`model_config = ConfigDict(...)`. If you type `@validator`, `.dict()`, or `orm_mode`, it is wrong.

Schemas live in `app/schemas/`, one module per entity, named by intent:

```python
class ConsultationBase(BaseModel):
    patient_name: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=5000)

class ConsultationCreate(ConsultationBase):
    diagnosis_codes: list[str] = Field(min_length=1, max_length=20)

class ConsultationRead(ConsultationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    diagnoses: list[DiagnosisRead]
```

Put the constraint in the `Field`, not in a hand-written `if` in the service. Strip and
reject whitespace-only strings with a validator — `"   "` is not a patient name.

Settings are a `BaseSettings` subclass in `app/core/config.py`, instantiated once as
`settings`. Read config from `settings`, never from `os.environ` at a call site.

## SQLAlchemy 2.0

Declarative with `Mapped` / `mapped_column`, and the 2.0 query API. `session.query(...)`
is legacy — use `select()`:

```python
class Consultation(Base):
    __tablename__ = "consultations"
    id: Mapped[int] = mapped_column(primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(200), index=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    diagnoses: Mapped[list[DiagnosisCode]] = relationship(secondary=consultation_diagnoses)

stmt = select(Consultation).where(Consultation.patient_name.ilike(f"%{term}%"))
rows = session.execute(stmt).scalars().all()
```

Always `.scalars()` when selecting entities, or you get `Row` tuples and confusing errors later.

Eager-load relationships you will serialise (`selectinload(Consultation.diagnoses)`).
The consultation list page returns codes for every row — without it you get N+1 queries.

Never build SQL by string concatenation or f-string interpolation of user input. Bind
parameters. The one f-string above is inside `ilike`'s _value_, which is parameterised —
interpolating into the statement text is not.

Sessions come from `Depends(get_db)` and are passed down as an argument. No global session,
no session created inside a repository, no `session.commit()` outside a service.

## FastAPI

Routers per entity under `app/api/v1/`, assembled in `router.py`, mounted in `main.py`
with prefix `/api/v1`. Plural resource paths: `/diagnoses`, `/consultations`.

Every route declares `response_model` and an explicit `status_code` when it is not 200
(`201` on create). Route handlers for DB work are `def`, not `async def` — the session is
synchronous and `async def` would block the event loop.

```python
@router.post("/", response_model=ConsultationRead, status_code=201)
def create_consultation(
    payload: ConsultationCreate,
    db: Session = Depends(get_db),
) -> Consultation:
    return consultation_service.create(db, payload)
```

Pagination via `limit` / `offset` query params with sane defaults (`limit=50`, hard max 100).
Never return an unbounded list.

## Errors

One envelope, produced only by exception handlers registered in `main.py`:

```json
{
  "error": { "code": "NOT_FOUND", "message": "Consultation 42 does not exist" }
}
```

Domain exceptions in `app/core/exceptions.py` carry a `code` and a message; handlers map
them to status codes — `NotFoundError` → 404, `ValidationError` → 422, `ConflictError` → 409,
everything unhandled → 500 with a generic message. Pydantic's own 422 is reshaped into the
same envelope so the frontend has exactly one error format to parse.

Messages are safe to show a user: no stack traces, no SQL, no file paths, no
"user with email x@y not found" (that leaks). Log the detail server-side, return the short form.

Never swallow an exception to make a test pass. Never `except Exception: pass`.

## TypeScript & Vue

`<script setup lang="ts">` everywhere. Composition API only, no Options API, no class
components. Strict TS — no `any`, no `@ts-ignore`; if a type is genuinely unknown, use
`unknown` and narrow.

Naming: components `PascalCase.vue` and multi-word (`ConsultationTable.vue`, never
`Table.vue`), composables `useThing.ts`, types `PascalCase`, variables and functions
`camelCase`, files in `pages/` `kebab-case` because they are URLs.

Props are typed with `defineProps<Props>()` and an interface, never the runtime array form.
Emits are declared with `defineEmits<{ ... }>()`. A component mutates nothing it does not own.

Composables return `readonly` refs plus explicit action functions when callers should not
write state directly.

`types/api.ts` mirrors the backend schemas by hand and keeps backend field names —
`patient_name`, `created_at`, `diagnosis_codes`. Do not camelCase them on the way in;
one naming scheme end to end is worth more than idiomatic JS here.

Fetching: `useFetch` / `useAsyncData` for page-load data, `$fetch` for user-triggered
actions — both only inside `composables/`, never in a `.vue` file. Always handle the
pending and error states in the UI; a table that renders nothing on failure is a bug.

Styling: scoped CSS or utility classes, consistently. No inline `style` attributes beyond
a computed dynamic value. Keep the UI plain and accessible — labels tied to inputs, buttons
that are `<button>`, focus states intact. "Intuitive" is in the assignment brief.

## Git

Small, scoped, working commits. Conventional Commits:
`feat(backend): add consultation create endpoint`, `test(frontend): cover diagnosis search`.
Scope is `backend`, `frontend`, or `repo`. One concern per commit; a refactor and a feature
do not share a commit. Never commit generated or local files — check `git status` before staging.
