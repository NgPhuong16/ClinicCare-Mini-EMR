import pytest
from pydantic import ValidationError as PydanticValidationError

from app.schemas.consultation import ConsultationCreate


def _payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "patient_name": "Nguyen An",
        "diagnosis_codes": ["E11.9"],
    }
    payload.update(overrides)
    return payload


def test_create_schema_strips_patient_name() -> None:
    assert ConsultationCreate(**_payload(patient_name="  Nguyen An  ")).patient_name == "Nguyen An"


@pytest.mark.parametrize("name", ["", "   ", "\t\n"])
def test_create_schema_rejects_blank_patient_name(name: str) -> None:
    with pytest.raises(PydanticValidationError):
        ConsultationCreate(**_payload(patient_name=name))


def test_create_schema_rejects_empty_diagnosis_codes() -> None:
    with pytest.raises(PydanticValidationError):
        ConsultationCreate(**_payload(diagnosis_codes=[]))


def test_create_schema_uppercases_and_dedupes_codes() -> None:
    schema = ConsultationCreate(**_payload(diagnosis_codes=[" e11.9 ", "I10", "e11.9"]))

    assert schema.diagnosis_codes == ["E11.9", "I10"]


def test_create_schema_rejects_blank_code() -> None:
    with pytest.raises(PydanticValidationError):
        ConsultationCreate(**_payload(diagnosis_codes=["   "]))


def test_create_schema_blank_notes_become_none() -> None:
    assert ConsultationCreate(**_payload(notes="   ")).notes is None
