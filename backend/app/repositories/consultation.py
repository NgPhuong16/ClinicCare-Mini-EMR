from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.consultation import Consultation, consultation_diagnoses
from app.models.diagnosis import DiagnosisCode
from app.repositories._like import ESCAPE, contains_pattern


def create(
    session: Session,
    patient_name: str,
    notes: str | None,
    diagnoses: list[DiagnosisCode],
) -> Consultation:
    consultation = Consultation(patient_name=patient_name, notes=notes, diagnoses=diagnoses)
    session.add(consultation)
    session.flush()
    return consultation


def list_(
    session: Session,
    patient: str | None,
    code: str | None,
    limit: int,
    offset: int,
) -> list[Consultation]:
    stmt = (
        select(Consultation)
        # Every row serialises its codes; without this the list is one query per row.
        .options(selectinload(Consultation.diagnoses))
        # created_at is second-granular, so rows written in the same second tie. id breaks
        # the tie and keeps "newest first" stable.
        .order_by(Consultation.created_at.desc(), Consultation.id.desc())
        .limit(limit)
        .offset(offset)
    )
    if patient:
        stmt = stmt.where(
            Consultation.patient_name.collate("NOCASE").like(
                contains_pattern(patient), escape=ESCAPE
            )
        )
    if code:
        # Join rather than a correlated EXISTS: the join drives off
        # ix_consultation_diagnoses_diagnosis_code, while EXISTS scans consultations and
        # probes per row. The composite PK means one join row per consultation, so no
        # DISTINCT is needed. Filtering here rather than in Python also keeps the limit
        # honest — post-filtering a fetched page would drop matching rows.
        stmt = stmt.join(
            consultation_diagnoses,
            consultation_diagnoses.c.consultation_id == Consultation.id,
        ).where(consultation_diagnoses.c.diagnosis_code == code)
    return list(session.execute(stmt).scalars().all())
