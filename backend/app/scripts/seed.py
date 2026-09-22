"""Load seeds/icd10_seed.sql into diagnosis_codes.

Run with `uv run python -m app.scripts.seed` after `alembic upgrade head`. Re-running is
safe: the seed file uses ON CONFLICT DO NOTHING, so existing codes are left untouched.
"""

import logging
import sys
from pathlib import Path

from sqlalchemy import func, inspect, select, text
from sqlalchemy.engine import Engine

from app.core.database import engine
from app.models.diagnosis import DiagnosisCode

SEED_FILE = Path(__file__).resolve().parents[2] / "seeds" / "icd10_seed.sql"

logger = logging.getLogger(__name__)


def load_seed(target: Engine, seed_file: Path = SEED_FILE) -> tuple[int, int]:
    """Execute the seed file. Returns (rows_before, rows_after)."""
    if not inspect(target).has_table(DiagnosisCode.__tablename__):
        raise RuntimeError(
            f"Table {DiagnosisCode.__tablename__!r} does not exist; run `alembic upgrade head`"
        )
    count = select(func.count()).select_from(DiagnosisCode)
    with target.begin() as conn:
        before = conn.execute(count).scalar_one()
        conn.execute(text(seed_file.read_text(encoding="utf-8")))
        after = conn.execute(count).scalar_one()
    return before, after


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        before, after = load_seed(engine)
    except RuntimeError as exc:
        logger.error("%s", exc)
        return 1
    logger.info(
        "diagnosis_codes: %d row(s) inserted, %d already present, %d total",
        after - before,
        before,
        after,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
