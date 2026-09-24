from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    ALGORITHM,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_verify_password_accepts_correct_password() -> None:
    hashed = hash_password("correct horse battery staple")

    assert verify_password("correct horse battery staple", hashed) is True


def test_verify_password_rejects_wrong_password() -> None:
    hashed = hash_password("correct horse battery staple")

    assert verify_password("wrong password", hashed) is False


def test_hash_password_salts_differently_each_time() -> None:
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")

    assert first != second
    assert verify_password("correct horse battery staple", first) is True
    assert verify_password("correct horse battery staple", second) is True


@pytest.mark.parametrize(
    "malformed",
    [
        "plaintext",
        "bcrypt$x$y",
        "scrypt$abc$8$1$AA==$AA==",
        "scrypt$3$8$1$AA==$AA==",
        "scrypt$16384$8$1$not-base64!!$AA==",
    ],
)
def test_verify_password_rejects_malformed_hash_without_raising(malformed: str) -> None:
    assert verify_password("anything", malformed) is False


def test_decode_access_token_round_trips_the_doctor_id() -> None:
    token = create_access_token(42)

    assert decode_access_token(token) == 42


def test_decode_access_token_rejects_token_signed_with_a_different_secret() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": "1", "iat": now, "exp": now + timedelta(minutes=5)},
        "a-different-secret-that-is-long-enough",
        algorithm=ALGORITHM,
    )

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token)


def test_decode_access_token_rejects_expired_token() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": "1", "iat": now - timedelta(hours=1), "exp": now - timedelta(minutes=1)},
        settings.jwt_secret.get_secret_value(),
        algorithm=ALGORITHM,
    )

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token)


def test_decode_access_token_rejects_alg_none() -> None:
    token = jwt.encode({"sub": "1"}, key="", algorithm="none")

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token)


def test_decode_access_token_rejects_non_integer_sub() -> None:
    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": "not-an-id", "iat": now, "exp": now + timedelta(minutes=5)},
        settings.jwt_secret.get_secret_value(),
        algorithm=ALGORITHM,
    )

    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token)
