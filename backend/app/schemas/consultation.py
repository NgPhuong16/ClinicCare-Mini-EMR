from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.diagnosis import DiagnosisRead


class ConsultationBase(BaseModel):
    patient_name: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("patient_name")
    @classmethod
    def _patient_name_not_blank(cls, value: str) -> str:
        # min_length alone accepts "   "; store the stripped form so the list filter matches.
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @field_validator("notes")
    @classmethod
    def _notes_blank_is_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ConsultationCreate(ConsultationBase):
    diagnosis_codes: list[str] = Field(min_length=1, max_length=20)

    @field_validator("diagnosis_codes")
    @classmethod
    def _codes_are_clean_and_unique(cls, value: list[str]) -> list[str]:
        codes = [code.strip().upper() for code in value]
        if any(not code for code in codes):
            raise ValueError("must not contain a blank code")
        # Duplicates would violate the join table's composite PK at flush time, which
        # surfaces as a 500. Collapse them here instead, preserving order.
        return list(dict.fromkeys(codes))


class ConsultationRead(ConsultationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    diagnoses: list[DiagnosisRead]

    @field_validator("created_at", mode="after")
    @classmethod
    def _created_at_is_explicit_utc(cls, value: datetime) -> datetime:
        # SQLite's CURRENT_TIMESTAMP is UTC but the column is naive, so the serialised
        # value would carry no offset and a client would be free to read it as local time.
        # Attach UTC here rather than changing the column.
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
