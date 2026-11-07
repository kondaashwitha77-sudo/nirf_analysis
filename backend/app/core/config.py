"""Centralised application settings.

Values come from environment variables and an optional ``.env`` file (see ``.env.example``).
"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

DEFAULT_DATABASE_URL = "sqlite:///./nirf_insights.db"
DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "NIRF Insights API"
    app_version: str = "1.0.0"
    environment: Literal["development", "testing", "production"] = "development"
    # Debug mode enables auto-reload and includes error detail in 500 responses.
    # It defaults to off so a missing .env can never leak internals.
    debug: bool = False
    api_prefix: str = "/api"

    # SQLite for local development. Any SQLAlchemy URL works, e.g.
    # postgresql+psycopg://user:password@localhost:5432/nirf_insights
    database_url: str = DEFAULT_DATABASE_URL

    # Comma-separated list (or a JSON array) of allowed browser origins.
    cors_origins: Annotated[list[str], NoDecode] = DEFAULT_CORS_ORIGINS

    # AI Analyst (optional). The key is only ever read here, on the server; the browser never sees it.
    # Any OpenAI-compatible provider works (xAI Grok by default). Leave AI_API_KEY empty to disable.
    ai_api_key: SecretStr | None = None
    ai_base_url: str = "https://api.x.ai/v1"
    ai_model: str = "grok-4"
    ai_timeout_seconds: float = 30.0

    log_level: str = "INFO"
    host: str = "127.0.0.1"
    port: int = 8000

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                import json

                return json.loads(text)
            return [part.strip() for part in text.split(",") if part.strip()]
        return value

    @field_validator("api_prefix")
    @classmethod
    def _normalise_prefix(cls, value: str) -> str:
        value = value.strip()
        if not value or value == "/":
            return ""
        return "/" + value.strip("/")

    @field_validator("log_level")
    @classmethod
    def _upper_level(cls, value: str) -> str:
        level = value.strip().upper()
        if level not in {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}:
            raise ValueError(f"Unsupported log level: {value}")
        return level


@lru_cache
def get_settings() -> Settings:
    return Settings()
