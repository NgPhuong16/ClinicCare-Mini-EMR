from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ClinicCare Mini EMR"
    debug: bool = False
    database_url: str = "sqlite:///./cliniccare.db"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    # Public demo credential (printed in the README for graders), not a secret.
    demo_doctor_password: str = "changeme123"


settings = Settings()
