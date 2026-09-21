# Testing

Read before writing or changing tests.

## Principles

Tests exist to catch real regressions, not to inflate a coverage number. A test that only
restates the implementation ("service calls repository once") is noise — delete it rather
than maintain it.

Test behaviour through the nearest real boundary. Prefer a real in-memory SQLite database
over a mocked session: it is fast, it catches actual SQL and constraint errors, and mocking
SQLAlchemy is more code than using it.

Every bug fix starts with a failing test that reproduces it. Never change a test to make a
failing build green unless the test itself encodes the wrong expectation — and say so in
the commit message when you do.

## Backend layout

```
backend/tests/
├── conftest.py          shared fixtures
├── factories.py         test-data builders
├── unit/                services with fake repositories; pure helpers; validators
└── integration/         API through TestClient against in-memory SQLite
```

Naming: `test_<unit>_<condition>_<expected>`, e.g.
`test_create_consultation_unknown_code_raises_validation_error`. Arrange / act / assert,
separated by a blank line. One behaviour per test — if you need two `assert` blocks about
two different things, write two tests.

## Fixtures

`conftest.py` provides a fresh schema per test, a session bound to it, and a client with
`get_db` overridden:

```python
@pytest.fixture
def db() -> Iterator[Session]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

`StaticPool` matters — without it each connection gets its own empty in-memory database
and inserts vanish between the test and the request.

Always clear `dependency_overrides` afterwards. A leaked override makes an unrelated test
fail later and costs an hour to find.

Test data comes from `factories.py` helpers with sensible defaults and keyword overrides
(`make_consultation(patient_name="Nguyen An")`). No hand-built dicts copy-pasted across files.
Never depend on seed data or on another test having run first — every test creates what it needs.

## What to cover

Integration, one test per path at minimum: diagnosis search returns matches and respects
the limit; search with an empty or whitespace term is rejected rather than dumping the table;
creating a consultation returns 201 with the codes attached; creating with an unknown code
returns 422 in the error envelope; creating with zero codes is rejected; listing returns
newest first; filtering by patient and by code each narrow the list; an unknown id returns
404 in the envelope.

Unit, where the logic actually is: service rules with a fake repository (a small hand-written
stub class, not `MagicMock`), Pydantic validators for boundary and whitespace input, and any
pure helper such as search-term normalisation.

Assert on the response envelope shape too, not only the status code — the frontend parses
`error.code`, so a handler that quietly returns FastAPI's default `{"detail": ...}` is a
real break that a status-only assertion misses.

## Mocking policy

Mock at the system's edges, not inside it. Acceptable: time (`freezegun` or an injected
clock), randomness, and any outbound network call. Not acceptable: the database, the
session, SQLAlchemy internals, or Pydantic.

When a unit test needs a repository, write a small stub class that satisfies the handful of
methods used. `MagicMock` will happily accept a call to a method that no longer exists and
let a broken refactor pass.

There are no outbound network calls in this project. If a test needs the internet, the
design is wrong.

## Frontend

Vitest plus `@vue/test-utils` and `@nuxt/test-utils`. Tests sit next to the file as
`Thing.spec.ts`, or in `tests/` for composables.

Cover: composables with `$fetch` stubbed — success, empty result, and error, checking that
the error surfaces rather than being swallowed; form components for validation messages,
disabled submit while pending, and the payload shape emitted on submit; table components for
empty state and correct rendering of a row's codes.

Do not test Nuxt's router, Vue's reactivity, or that a `<h1>` contains the literal text you
just wrote into it. Stub the network at `$fetch`; never hit a real backend from a unit test.

## Running

```bash
cd backend  && uv run pytest -q
cd backend  && uv run pytest tests/integration/test_consultation_api.py -q -k create
cd frontend && pnpm test
```

Both suites must pass before a commit that touches their app. If a test is slow, it is
doing something it should not — find the real database or the sleep, and remove it.
