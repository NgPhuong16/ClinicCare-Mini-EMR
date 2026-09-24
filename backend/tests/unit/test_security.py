import pytest

from app.core.security import hash_password, verify_password


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
