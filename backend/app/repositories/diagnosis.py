from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.diagnosis import DiagnosisCode

_LIKE_ESCAPE = "\\"


def _escape_like(term: str) -> str:
    # `%` and `_` are LIKE wildcards; a user typing "E11_" should match literally, not
    # "E11" followed by any character.
    return (
        term.replace(_LIKE_ESCAPE, _LIKE_ESCAPE * 2)
        .replace("%", f"{_LIKE_ESCAPE}%")
        .replace("_", f"{_LIKE_ESCAPE}_")
    )


def search(session: Session, term: str, limit: int) -> list[DiagnosisCode]:
    pattern = f"%{_escape_like(term)}%"
    stmt = (
        select(DiagnosisCode)
        .where(
            or_(
                DiagnosisCode.code.collate("NOCASE").like(pattern, escape=_LIKE_ESCAPE),
                DiagnosisCode.description.collate("NOCASE").like(pattern, escape=_LIKE_ESCAPE),
            )
        )
        .order_by(DiagnosisCode.code)
        .limit(limit)
    )
    return list(session.execute(stmt).scalars().all())
