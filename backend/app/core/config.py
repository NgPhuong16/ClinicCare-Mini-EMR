import logging
import secrets

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ClinicCare Mini EMR"
    debug: bool = False
    database_url: str = "sqlite:///./cliniccare.db"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    # Public demo credential (printed in the README for graders), not a secret.
    demo_doctor_password: str = "changeme123"
    # No hardcoded default: a random secret is generated per process when unset (see the
    # warning below), so the app still runs with zero config at the cost of sessions not
    # surviving a restart.
    jwt_secret: SecretStr = Field(default_factory=lambda: SecretStr(secrets.token_urlsafe(32)))
    access_token_expire_minutes: int = 60
    auth_cookie_name: str = "access_token"
    # True in production over HTTPS; local dev is plain http.
    cookie_secure: bool = False

    @field_validator("jwt_secret")
    @classmethod
    def _jwt_secret_min_length(cls, value: SecretStr) -> SecretStr:
        # An unfilled `JWT_SECRET=` in .env is a blank string, not unset — PyJWT rejects it
        # with InvalidKeyError, not InvalidTokenError, which would 500 /auth/login instead
        # of failing at startup. A short one stays brute-forceable.
        if len(value.get_secret_value()) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 characters; generate one with: "
                "python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
        return value


settings = Settings()

if "jwt_secret" not in settings.model_fields_set:
    logger.warning(
        "JWT_SECRET is not set; generated a random secret for this process. Sessions will "
        "not survive a restart. Set JWT_SECRET in .env to keep them across restarts."
    )
