import os

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = Field(default_factory=lambda: os.environ["DATABASE_URL"])
    redis_url: str = "redis://redis:6379/0"
    jwt_secret: str = Field(default_factory=lambda: os.environ["JWT_SECRET"])
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080
    # DeepL API key for word translation (free keys end with ":fx"). Optional —
    # when unset, the /vocab translate+save endpoint returns a clear 502.
    deepl_api_key: str | None = None
    # Google Gemini — word enrichment (chunks, synonyms, gender...) and the
    # level-5 sentence evaluation. Env var: GEMINI_KEY.
    gemini_key: str | None = None
    # Anthropic Claude — fallback for enrichment/grading when Gemini fails or is
    # rate-limited. Uses the cheapest model (Haiku). Env var: CLAUDE_API_KEY.
    claude_api_key: str | None = None
    # Pexels image search for the level-2 picture exercise. Env var: PEXELS_API_KEY.
    pexels_api_key: str | None = None
    # How many mission words to enrich in parallel on first open. Higher = faster,
    # but risks Gemini free-tier rate limits (429 → retry, then Claude fallback).
    # Env var: ENRICH_CONCURRENCY.
    enrich_concurrency: int = 6
    # Times to retry Gemini on a 429/503 (rate-limited / overloaded) with
    # exponential backoff before falling back to Claude. Env: GEMINI_MAX_RETRIES.
    gemini_max_retries: int = 3
    # Comma-separated list: http://localhost:3000,https://app.vercel.app
    cors_origins: list[str] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
