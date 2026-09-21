---
description: Run all checks for whichever app(s) changed, then propose a scoped commit
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(uv run:*), Bash(pnpm:*), Read, Edit
---

Run the full check suite before any commit — never commit code that fails these.

## 1. Scope

`git status --porcelain` to see what changed. Determine whether `backend/`, `frontend/`,
or both have uncommitted changes. Only run checks for the app(s) that actually changed.

## 2. Backend checks (if `backend/` changed)

```bash
cd backend
uv run ruff check . --fix
uv run ruff format .
uv run mypy app
uv run pytest -q
```

## 3. Frontend checks (if `frontend/` changed)

```bash
cd frontend
pnpm lint --fix
pnpm typecheck
pnpm test
```

## 4. On failure

Stop. Report exactly which check failed and the relevant error output. Fix it, then re-run
every check from the top — a fix for one check can break another. Never commit with a
failing check, and never silence a failure (`# type: ignore`, a skipped test, a loosened
lint rule) just to get to green — fix the underlying issue or explain why the check is wrong.

## 5. Decisions check

Read the diff and ask: did this work settle anything a future session would otherwise
re-litigate — a convention, a tradeoff, a constraint, a guard against a non-obvious
failure? If yes, add the entry now via `/log-decision` so it lands in the same commit as
the code. If no, say "no decision to log" in one clause and carry on. Answer the question
explicitly either way; skipping it silently is how the log goes stale.

## 6. On success

Show `git diff --stat` and propose ONE commit scoped to a single logical change, using
Conventional Commits per `.claude/rules/coding-standards.md`
(`feat(backend): ...`, `fix(frontend): ...`, `test(backend): ...`). If the staged changes
span more than one concern (e.g. a feature plus an unrelated refactor), say so and propose
splitting into separate commits rather than committing everything at once.

Wait for confirmation before running `git commit`.
