from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.diagnosis import DiagnosisCode
from app.repositories import diagnosis as diagnosis_repository


def normalize_search_term(term: str) -> str:
    # A blank keyword must not degrade into "return the whole table"; reject it instead.
    normalized = term.strip().lower()
    if not normalized:
        raise ValidationError("Search term must not be empty")
    return normalized


def search(session: Session, term: str, limit: int) -> list[DiagnosisCode]:
    return diagnosis_repository.search(session, normalize_search_term(term), limit)
