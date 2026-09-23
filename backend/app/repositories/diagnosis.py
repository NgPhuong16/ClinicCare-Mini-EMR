from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.diagnosis import DiagnosisCode
from app.repositories._like import ESCAPE, contains_pattern


def get_many_by_codes(session: Session, codes: list[str]) -> list[DiagnosisCode]:
    if not codes:
        return []
    stmt = select(DiagnosisCode).where(DiagnosisCode.code.in_(codes))
    return list(session.execute(stmt).scalars().all())


def search(session: Session, term: str, limit: int) -> list[DiagnosisCode]:
    pattern = contains_pattern(term)
    stmt = (
        select(DiagnosisCode)
        .where(
            or_(
                DiagnosisCode.code.collate("NOCASE").like(pattern, escape=ESCAPE),
                DiagnosisCode.description.collate("NOCASE").like(pattern, escape=ESCAPE),
            )
        )
        .order_by(DiagnosisCode.code)
        .limit(limit)
    )
    return list(session.execute(stmt).scalars().all())
