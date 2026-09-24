from fastapi import Cookie, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.doctor import Doctor
from app.services import auth as auth_service


def get_current_doctor(
    token: str | None = Cookie(default=None, alias=settings.auth_cookie_name),
    db: Session = Depends(get_db),
) -> Doctor:
    return auth_service.get_doctor_from_token(db, token)


__all__ = ["get_current_doctor", "get_db"]
