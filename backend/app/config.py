import os

from pydantic import Field
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
    # Mistral (Mistral Small 4) — word enrichment (chunks, synonyms, gender...)
    # and the level-5 sentence evaluation. Env var: MISTRAL_API_KEY.
    mistral_api_key: str | None = None
    # Anthropic Claude — fallback for enrichment/grading when Mistral fails or is
    # rate-limited. Uses the cheapest model (Haiku). Env var: CLAUDE_API_KEY.
    claude_api_key: str | None = None
    # Pexels image search for the level-2 picture exercise. Env var: PEXELS_API_KEY.
    pexels_api_key: str | None = None
    # Default listening-step TTS provider (services.tts) — pyttsx3 is free/
    # offline. "elevenlabs" is also used per-request regardless of this
    # setting for B1 stories (see services.tts.provider_for_level).
    tts_provider: str = "pyttsx3"  # "pyttsx3" | "elevenlabs"
    # ElevenLabs, called directly via REST — powers the Speaking tab's voice
    # mode (speech-to-text/text-to-speech for the NPC's reply) and, for B1
    # stories, the Listening tab's TTS. Env: ELEVENLABS_API_KEY.
    elevenlabs_api_key: str | None = None
    elevenlabs_voice_id: str = "EYBbN7OENxAX5QX56IiW"
    # Second character's voice for long-form two-voice stories (services.story_audio)
    # — the first speaker to appear in a story uses elevenlabs_voice_id above, the
    # second uses this one. Env: ELEVENLABS_VOICE_ID_SECONDARY.
    elevenlabs_voice_id_secondary: str = "jBlmi27XRORxjPquUeCh"
    # How many mission words to enrich in parallel on first open. Higher = faster,
    # but risks Mistral free-tier rate limits (429 → retry, then Claude fallback).
    # Env var: ENRICH_CONCURRENCY.
    enrich_concurrency: int = 6
    # Times to retry Mistral on a 429/503 (rate-limited / overloaded) with
    # exponential backoff before falling back to Claude. Env: MISTRAL_MAX_RETRIES.
    mistral_max_retries: int = 3
    # Comma-separated list: http://localhost:3000,https://app.example.com
    # Kept as a raw string — pydantic-settings would otherwise try to JSON-decode
    # a list-typed env var and reject the comma form. Read via `cors_origins`.
    cors_origins_raw: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
