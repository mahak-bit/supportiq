"""Runtime configuration. Every value can be overridden with an environment variable
(or a backend/.env file). Secrets are only ever read here and never returned by the API."""

from __future__ import annotations

import secrets
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"

    # Storage
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'supportiq.db').as_posix()}"
    data_dir: Path = BACKEND_DIR / "data"

    # Auth
    jwt_secret: str = Field(default="")
    jwt_ttl_minutes: int = 60 * 12
    cookie_secure: bool = False
    seed_demo_password: str = "demo-password"

    # Seeding / workspace
    seed_on_startup: bool = True
    company_name: str = "Halden & Co."

    # LLM providers: "auto" picks Gemini when a key exists, else Ollama if reachable, else extractive.
    llm_provider: Literal["auto", "gemini", "ollama", "extractive"] = "auto"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    llm_timeout_seconds: float = 45.0
    llm_max_retries: int = 2

    # Retrieval
    embedding_provider: Literal["fastembed", "sentence-transformers", "hashing"] = "fastembed"
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    retrieval_top_k: int = 5
    # Below this cosine similarity a passage is not considered evidence. None = provider default.
    retrieval_min_score: float | None = None
    chunk_size: int = 900
    chunk_overlap: int = 150

    # Serverless hosts may freeze the process after the response, so index uploads before replying.
    inline_ingest: bool = False

    # Uploads / abuse protection
    max_upload_mb: int = 10
    max_message_chars: int = 8000
    ai_rate_limit_per_minute: int = 20
    login_rate_limit_per_minute: int = 10

    cors_origins: str = "http://localhost:3000"

    # Business rules (mirror the seeded policy documents)
    refund_lead_approval_threshold_cents: int = 30000

    def resolved_jwt_secret(self) -> str:
        if self.jwt_secret:
            return self.jwt_secret
        if self.environment == "production":
            raise RuntimeError("JWT_SECRET must be set in production")
        return _dev_secret()


@lru_cache
def _dev_secret() -> str:
    # Ephemeral per-process secret for local development: sessions reset on restart.
    return secrets.token_urlsafe(48)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings
