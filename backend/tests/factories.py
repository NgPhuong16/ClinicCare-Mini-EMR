from datetime import datetime

from app.models.consultation import Consultation
from app.models.diagnosis import DiagnosisCode


def make_diagnosis(
    code: str = "E11.9",
    description: str = "Type 2 diabetes mellitus without complications",
) -> DiagnosisCode:
    return DiagnosisCode(code=code, description=description)


def make_consultation(
    patient_name: str = "Nguyen An",
    notes: str | None = "Routine follow-up",
    diagnoses: list[DiagnosisCode] | None = None,
    created_at: datetime | None = None,
) -> Consultation:
    consultation = Consultation(patient_name=patient_name, notes=notes, diagnoses=diagnoses or [])
    if created_at is not None:
        consultation.created_at = created_at
    return consultation
