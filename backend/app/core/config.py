from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/credit.db"
    bank_api_token: SecretStr = SecretStr("demo-bank-token")
    pipeline_step_seconds: float = Field(default=1, ge=0, le=60)
    simulate_bki_failure: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
