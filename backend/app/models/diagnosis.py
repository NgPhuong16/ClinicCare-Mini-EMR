from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DiagnosisCode(Base):
    """ICD-10-CM reference data, loaded from seeds/icd10_seed.sql; never written at runtime."""

    __tablename__ = "diagnosis_codes"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
