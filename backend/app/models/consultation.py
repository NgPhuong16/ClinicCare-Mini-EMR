from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.diagnosis import DiagnosisCode

consultation_diagnoses = Table(
    "consultation_diagnoses",
    Base.metadata,
    Column(
        "consultation_id",
        ForeignKey("consultations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    # Indexed on its own: the composite PK only serves lookups that lead with
    # consultation_id, and the list endpoint filters by code.
    Column(
        "diagnosis_code",
        ForeignKey("diagnosis_codes.code"),
        primary_key=True,
        index=True,
    ),
)


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    diagnoses: Mapped[list[DiagnosisCode]] = relationship(
        secondary=consultation_diagnoses, order_by=DiagnosisCode.code
    )
