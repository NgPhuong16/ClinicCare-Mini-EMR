from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.doctor import Doctor


def get_by_email(session: Session, email: str) -> Doctor | None:
    stmt = select(Doctor).where(Doctor.email == email)
    return session.execute(stmt).scalar_one_or_none()


def get_by_id(session: Session, doctor_id: int) -> Doctor | None:
    stmt = select(Doctor).where(Doctor.id == doctor_id)
    return session.execute(stmt).scalar_one_or_none()
