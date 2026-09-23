from sqlalchemy.orm import Session

from app.core.exceptions import ValidationError
from app.models.consultation import Consultation
from app.models.diagnosis import DiagnosisCode
from app.repositories import consultation as consultation_repository
from app.repositories import diagnosis as diagnosis_repository
from app.schemas.consultation import ConsultationCreate


def _resolve_diagnoses(session: Session, codes: list[str]) -> list[DiagnosisCode]:
    found = diagnosis_repository.get_many_by_codes(session, codes)
    by_code = {row.code: row for row in found}
    missing = [code for code in codes if code not in by_code]
    if missing:
        raise ValidationError(f"Unknown diagnosis code(s): {', '.join(missing)}")
    return [by_code[code] for code in codes]


def create(session: Session, payload: ConsultationCreate) -> Consultation:
    # Resolve every code before writing anything, so a request naming an unknown code
    # leaves no partial consultation behind.
    diagnoses = _resolve_diagnoses(session, payload.diagnosis_codes)
    # Sort by code so this response matches what GET returns. SessionLocal sets
    # expire_on_commit=False, so the list built here survives the commit and is what the
    # client sees; GET reloads through the relationship's order_by=DiagnosisCode.code.
    # Without this sort the same consultation lists its codes differently depending on
    # whether it was just created or looked up later.
    diagnoses.sort(key=lambda diagnosis: diagnosis.code)
    consultation = consultation_repository.create(
        session, payload.patient_name, payload.notes, diagnoses
    )
    session.commit()
    return consultation


def _normalize_filter(value: str | None, upper: bool = False) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        # An all-whitespace filter means "no filter", not "match nothing".
        return None
    return stripped.upper() if upper else stripped


def list_(
    session: Session,
    patient: str | None,
    code: str | None,
    limit: int,
    offset: int,
) -> list[Consultation]:
    return consultation_repository.list_(
        session,
        patient=_normalize_filter(patient),
        code=_normalize_filter(code, upper=True),
        limit=limit,
        offset=offset,
    )
