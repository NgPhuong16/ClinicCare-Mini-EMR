from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base
from app.models.diagnosis import DiagnosisCode
from app.scripts.seed import SEED_FILE, load_seed


@pytest.fixture
def engine() -> Iterator[Engine]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


def _count(engine: Engine) -> int:
    with Session(engine) as session:
        return session.execute(select(func.count()).select_from(DiagnosisCode)).scalar_one()


def test_load_seed_inserts_100_codes(engine: Engine) -> None:
    before, after = load_seed(engine, SEED_FILE)

    assert (before, after) == (0, 100)
    assert _count(engine) == 100


def test_load_seed_is_idempotent(engine: Engine) -> None:
    load_seed(engine, SEED_FILE)

    before, after = load_seed(engine, SEED_FILE)

    assert (before, after) == (100, 100)


def test_load_seed_without_table_raises(engine: Engine) -> None:
    Base.metadata.drop_all(engine)

    with pytest.raises(RuntimeError, match="alembic upgrade head"):
        load_seed(engine, SEED_FILE)
