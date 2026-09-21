from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _enable_sqlite_foreign_keys(
    dbapi_connection: DBAPIConnection, _connection_record: ConnectionPoolEntry
) -> None:
    # SQLite ignores FK constraints (and ON DELETE CASCADE) unless enabled per connection.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def create_app_engine(url: str) -> Engine:
    connect_args = {}
    if url.startswith("sqlite"):
        # FastAPI runs sync routes in a threadpool, so a connection may be used off its
        # creating thread.
        connect_args["check_same_thread"] = False
    engine = create_engine(url, connect_args=connect_args)
    if url.startswith("sqlite"):
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    return engine


engine = create_app_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
