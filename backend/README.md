# ClinicCare backend

FastAPI + SQLAlchemy 2.0 + SQLite, managed with [uv](https://docs.astral.sh/uv/).
Project overview and full setup instructions live in the [root README](../README.md).

```bash
uv sync                              # install dependencies
uv run alembic upgrade head          # create the schema
uv run python -m app.scripts.seed    # load ICD-10 codes
uv run fastapi dev app/main.py       # http://localhost:8000 (docs at /docs)
uv run pytest -q                     # tests
uv run ruff check . --fix && uv run mypy app
```

Configuration comes from `app/core/config.py`; copy `.env.example` to `.env` to override
any default. Architecture and conventions are documented in `../CLAUDE.md` and
`../.claude/rules/`.
