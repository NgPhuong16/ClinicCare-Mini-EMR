"""Password hashing and email normalisation shared by the seed script and the auth service.

stdlib `hashlib.scrypt` instead of a hashing dependency (passlib is unmaintained and breaks
on recent bcrypt) — see CLAUDE.md's "no dependency for what the stdlib does".
"""

import base64
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings

_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16

# Fixed, not a setting: changing the signing algorithm is a code change, not config.
ALGORITHM = "HS256"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    derived = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P
    )
    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(derived).decode("ascii")
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${salt_b64}${hash_b64}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, hash_b64 = hashed.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p))
    except ValueError, TypeError:
        return False
    return hmac.compare_digest(derived, expected)


def create_access_token(doctor_id: int) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(doctor_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> int:
    """Raises jwt.InvalidTokenError (covers expired/malformed/bad-signature tokens and a
    non-integer `sub`) on anything invalid — callers only need to catch that one type."""
    payload = jwt.decode(token, settings.jwt_secret.get_secret_value(), algorithms=[ALGORITHM])
    try:
        return int(payload["sub"])
    except (KeyError, ValueError, TypeError) as exc:
        raise jwt.InvalidTokenError("Token subject is not a valid doctor id") from exc
