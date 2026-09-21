---
description: Scaffold a new backend entity end-to-end through every architecture layer
argument-hint: <entity-name, e.g. consultation>
allowed-tools: Read, Write, Edit, Bash(uv run:*)
---

Scaffold the entity **$ARGUMENTS** through every backend layer, following
`.claude/rules/architecture.md` and `.claude/rules/coding-standards.md` exactly. Read both
files first if you haven't already this session.

## Order

1. **Model** — `app/models/$ARGUMENTS.py`: SQLAlchemy 2.0 declarative class, `Mapped` /
   `mapped_column`. No business logic here.
2. **Schemas** — `app/schemas/$ARGUMENTS.py`: split by intent (`...Base`, `...Create`,
   `...Read` at minimum). `...Read` sets `model_config = ConfigDict(from_attributes=True)`.
   A create schema never accepts `id` or server-set timestamps.
3. **Repository** — `app/repositories/$ARGUMENTS.py`: every query for this entity, using
   `select()` (never `session.query`), takes a `Session` as its first argument, returns
   ORM objects or `None`. No HTTP concepts, no business rules.
4. **Service** — `app/services/$ARGUMENTS.py`: business rules, orchestrates the repository,
   owns the transaction (`session.commit()`). Raises domain exceptions from
   `app/core/exceptions.py` — never `HTTPException`, never imports `fastapi`.
5. **Route** — `app/api/v1/$ARGUMENTS.py`: thin. Declares `response_model` and explicit
   `status_code` where not 200, uses `Depends(get_db)`, calls exactly one service method.
   Plain `def`, not `async def` (the session is sync). Register the router in
   `app/api/v1/router.py`.
6. **Test** — `tests/integration/test_${ARGUMENTS}_api.py`: at minimum, the happy path and
   the primary failure path (not-found or validation error) through `TestClient`, asserting
   on the error envelope shape, not just the status code. Add `tests/unit/` coverage for
   any non-trivial service logic.

## Before reporting done

Run, and fix anything they flag — don't hand back code that fails these:

```bash
cd backend
uv run ruff check . --fix && uv run ruff format .
uv run mypy app
uv run pytest -q
```

Then stop and summarize what was added per layer, rather than proposing a commit — let the
person (or `/precommit`) decide when to commit.
