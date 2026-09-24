from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor, get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.models.doctor import Doctor
from app.schemas.auth import DoctorRead, LoginRequest
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=DoctorRead)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> Doctor:
    doctor = auth_service.authenticate(db, payload.email, payload.password)
    token = create_access_token(doctor.id)
    # Token goes only in the cookie, never the body — putting it in the body would defeat
    # httponly.
    response.set_cookie(
        settings.auth_cookie_name,
        token,
        max_age=settings.access_token_expire_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
    return doctor


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    response.delete_cookie(
        settings.auth_cookie_name,
        path="/",
        samesite="lax",
        secure=settings.cookie_secure,
        httponly=True,
    )


@router.get("/me", response_model=DoctorRead)
def me(current_doctor: Doctor = Depends(get_current_doctor)) -> Doctor:
    return current_doctor
