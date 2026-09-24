"""Load seeds/icd10_seed.sql into diagnosis_codes.

Run with `uv run python -m app.scripts.seed` after `alembic upgrade head`. Re-running is
safe: the seed file uses ON CONFLICT DO NOTHING, so existing codes are left untouched.
"""

import logging
import sys
from pathlib import Path

from sqlalchemy import func, inspect, select, text
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine

from app.core.config import settings
from app.core.database import engine
from app.core.security import hash_password, normalize_email
from app.models.diagnosis import DiagnosisCode
from app.models.doctor import Doctor

SEED_FILE = Path(__file__).resolve().parents[2] / "seeds" / "icd10_seed.sql"
DEMO_DOCTOR_EMAIL = "doctor@cliniccare.local"

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


def seed_demo_doctor(target: Engine) -> tuple[int, int]:
    """Insert the demo doctor account. Returns (rows_before, rows_after)."""
    if not inspect(target).has_table(Doctor.__tablename__):
        raise RuntimeError(
            f"Table {Doctor.__tablename__!r} does not exist; run `alembic upgrade head`"
        )
    count = select(func.count()).select_from(Doctor)
    with target.begin() as conn:
        before = conn.execute(count).scalar_one()
        stmt = (
            sqlite_insert(Doctor)
            .values(
                email=normalize_email(DEMO_DOCTOR_EMAIL),
                hashed_password=hash_password(settings.demo_doctor_password),
            )
            .on_conflict_do_nothing(index_elements=["email"])
        )
        conn.execute(stmt)
        after = conn.execute(count).scalar_one()
    return before, after


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        before, after = load_seed(engine)
        doctors_before, doctors_after = seed_demo_doctor(engine)
    except RuntimeError as exc:
        logger.error("%s", exc)
        return 1
    logger.info(
        "diagnosis_codes: %d row(s) inserted, %d already present, %d total",
        after - before,
        before,
        after,
    )
    logger.info(
        "doctors: %d row(s) inserted, %d already present, %d total",
        doctors_after - doctors_before,
        doctors_before,
        doctors_after,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
