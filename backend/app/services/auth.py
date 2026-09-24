import jwt
from sqlalchemy.orm import Session

from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token, hash_password, normalize_email, verify_password
from app.models.doctor import Doctor
from app.repositories import doctor as doctor_repository

_INVALID_CREDENTIALS = "Invalid email or password"
_NOT_AUTHENTICATED = "Not authenticated"
# Computed once, not per request, and checked even when the email doesn't exist: without
# it, a lookup miss returns instantly while a wrong password runs a real scrypt hash,
# and the time difference lets a client enumerate which emails have accounts.
_DUMMY_HASH = hash_password("not-a-real-account-password")


def authenticate(session: Session, email: str, password: str) -> Doctor:
    doctor = doctor_repository.get_by_email(session, normalize_email(email))
    if doctor is None:
        verify_password(password, _DUMMY_HASH)
        raise UnauthorizedError(_INVALID_CREDENTIALS)
    if not verify_password(password, doctor.hashed_password):
        raise UnauthorizedError(_INVALID_CREDENTIALS)
    return doctor


def get_doctor_from_token(session: Session, token: str | None) -> Doctor:
    if token is None:
        raise UnauthorizedError(_NOT_AUTHENTICATED)
    try:
        doctor_id = decode_access_token(token)
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError(_NOT_AUTHENTICATED) from exc
    doctor = doctor_repository.get_by_id(session, doctor_id)
    if doctor is None:
        raise UnauthorizedError(_NOT_AUTHENTICATED)
    return doctor
