# ClinicCare backend

FastAPI + SQLAlchemy 2.0 + SQLite, managed with [uv](https://docs.astral.sh/uv/).
Project overview and full setup instructions live in the [root README](../README.md).

```bash
uv sync                              # install dependencies
uv run alembic upgrade head          # create the schema
uv run python -m app.scripts.seed    # load 100 ICD-10 codes + the demo doctor
uv run fastapi dev app/main.py       # http://localhost:8000 (docs at /docs)
uv run pytest -q                     # tests
uv run ruff check . --fix && uv run mypy app
```

Configuration comes from `app/core/config.py`; copy `.env.example` to `.env` to override
any default, including `JWT_SECRET` (unset by default — a restart then logs every doctor
out; see the root README). Architecture and conventions are documented in `../CLAUDE.md`
and `../.claude/rules/`.
