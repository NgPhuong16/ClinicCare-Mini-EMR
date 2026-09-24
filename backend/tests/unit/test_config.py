import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_jwt_secret_empty_string_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None, jwt_secret="")


def test_jwt_secret_too_short_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None, jwt_secret="x" * 31)


def test_jwt_secret_minimum_length_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET", raising=False)

    settings = Settings(_env_file=None, jwt_secret="x" * 32)

    assert settings.jwt_secret.get_secret_value() == "x" * 32


def test_settings_without_jwt_secret_generates_one(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET", raising=False)

    settings = Settings(_env_file=None)

    assert len(settings.jwt_secret.get_secret_value()) >= 32
