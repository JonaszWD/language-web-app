"""Text-to-speech via pyttsx3 (offline, non-AI, no API key/quota), with
ElevenLabs available per-request for higher-fidelity content.

Synthesises Spanish audio for the listening step through pyttsx3 — espeak-ng
inside the backend's Linux container (see Dockerfile). No network call, no
per-character cost, no rate limit. This stays the default provider
(`settings.tts_provider`, env TTS_PROVIDER).

`synthesize`/`prewarm`/`is_cached` all accept an optional `provider` override
(falling back to the default above) so a caller can route specific content to
ElevenLabs — e.g. routers.tts resolves B1 listening stories to "elevenlabs"
via `provider_for_level` — without a global setting change. The ElevenLabs
path reuses services.speech_engine's direct REST client (same
ELEVENLABS_API_KEY/ELEVENLABS_VOICE_ID already used by the Speaking tab)
rather than the LiteLLM-proxy settings below, which stay unused unless a
proxy is actually configured.

Audio is persisted to disk (TTS_DIR, a mounted volume in prod — same pattern as
podcast audio) keyed by provider+voice+text, so a phrase is synthesised at most
once ever per provider and survives restarts. A mission's listening audio is
pre-generated in bulk when the mission is opened (see prewarm / routers.tts),
so by the time the learner reaches the listening step every clip is already on
disk.
"""
from __future__ import annotations

import hashlib
import logging
import os
import time
from pathlib import Path

import pyttsx3

from app.config import settings
from app.services import speech_engine

logger = logging.getLogger("tts")

# Cache-key tag per provider/voice — bump a provider's entry (not just the
# voice id) whenever its synthesis approach changes, so old clips from a
# previous engine are never served as if they matched.
_VOICE_BY_PROVIDER = {
    "pyttsx3": "pyttsx3-es",
    "elevenlabs": f"elevenlabs:{settings.elevenlabs_voice_id}",
}

# File extension per provider — pyttsx3 writes wav, ElevenLabs mp3.
_FORMAT_BY_PROVIDER = {"pyttsx3": "wav", "elevenlabs": "mp3"}

# Back-compat export for the default provider — routers.tts uses this for the
# default (non-overridden) response's media type.
AUDIO_FORMAT = _FORMAT_BY_PROVIDER[settings.tts_provider]


def audio_format(provider: str | None = None) -> str:
    """File/media-type format for `provider` (defaults to settings.tts_provider)."""
    return _FORMAT_BY_PROVIDER[provider or settings.tts_provider]

# Words/second pyttsx3's rate property, tuned down from espeak-ng's default
# (~200) for a learner-friendly pace rather than rapid-fire speech.
_RATE = 150

# Persistent on-disk cache. Same convention as podcast AUDIO_DIR — a named volume
# in prod so generated clips survive restarts.
TTS_DIR = Path(os.getenv("TTS_DIR", "/data/tts"))


class TTSError(Exception):
    """Raised when audio could not be synthesised."""


def _cache_path(text: str, provider: str) -> Path:
    """Stable on-disk path for a phrase, keyed by provider+voice+text so a
    voice/provider change doesn't serve stale audio."""
    digest = hashlib.sha1(f"{_VOICE_BY_PROVIDER[provider]}:{text}".encode()).hexdigest()
    return TTS_DIR / f"{digest}.{_FORMAT_BY_PROVIDER[provider]}"


def _pick_spanish_voice(engine: "pyttsx3.Engine") -> str | None:
    """Best-effort match for a Spanish voice across drivers — espeak-ng in
    Docker (ids like 'spanish' or 'es') and macOS's NSSpeechSynthesizer if this
    ever runs outside the container (ids like 'com.apple.voice...es-MX...')."""
    for v in engine.getProperty("voices"):
        vid = (v.id or "").lower()
        name = (v.name or "").lower()
        langs = [str(lang).lower() for lang in (v.languages or [])]
        if "spanish" in vid or "spanish" in name or vid in ("es", "es-es", "es-419"):
            return v.id
        if any(lang.startswith("es") for lang in langs):
            return v.id
    return None


def _call_pyttsx3_tts(text: str) -> bytes:
    """Synthesise `text` via pyttsx3 and return WAV bytes. No caching here.

    A fresh engine is created per call rather than reused — pyttsx3's run loop
    (runAndWait) isn't safe to re-enter across concurrent requests in the same
    process."""
    engine = pyttsx3.init()
    try:
        voice_id = _pick_spanish_voice(engine)
        if voice_id:
            engine.setProperty("voice", voice_id)
        else:
            logger.warning("No Spanish voice found for pyttsx3 — using engine default.")
        engine.setProperty("rate", _RATE)

        TTS_DIR.mkdir(parents=True, exist_ok=True)
        tmp = TTS_DIR / f".tmp-{hashlib.sha1(text.encode()).hexdigest()}.wav"
        engine.save_to_file(text, str(tmp))
        engine.runAndWait()

        # The espeak driver's save_to_file spawns the actual synthesis as a
        # subprocess and runAndWait() can return before it's finished writing —
        # poll for the file to appear and its size to stop changing rather than
        # trusting runAndWait's return as "done".
        last_size = -1
        for _ in range(50):  # up to ~5s
            if tmp.exists():
                size = tmp.stat().st_size
                if size > 0 and size == last_size:
                    break
                last_size = size
            time.sleep(0.1)

        if not tmp.exists() or tmp.stat().st_size == 0:
            raise TTSError("pyttsx3 produced no audio output.")
        wav = tmp.read_bytes()
        tmp.unlink(missing_ok=True)
        return wav
    except TTSError:
        raise
    except Exception as exc:  # pyttsx3 raises driver-specific errors, not one type
        raise TTSError(f"pyttsx3 synthesis failed: {exc}") from exc
    finally:
        engine.stop()


def _call_elevenlabs_tts(text: str) -> bytes:
    """Synthesise `text` via ElevenLabs (services.speech_engine's direct REST
    client). No caching here. Reached whenever the resolved provider is
    "elevenlabs" — either settings.tts_provider is set that way, or a caller
    (e.g. B1 listening stories) requested it explicitly via
    provider_for_level."""
    try:
        return speech_engine.synthesize(text)
    except speech_engine.SpeechEngineError as exc:
        raise TTSError(f"ElevenLabs synthesis failed: {exc}") from exc


_SYNTH_BY_PROVIDER = {
    "pyttsx3": _call_pyttsx3_tts,
    "elevenlabs": _call_elevenlabs_tts,
}


def synthesize(text: str, provider: str | None = None) -> bytes:
    """Return audio for `text`, spoken in Spanish, using `provider` (defaults
    to settings.tts_provider). Served from the on-disk cache when present,
    otherwise synthesised and persisted first.

    Raises TTSError when synthesis produces no usable audio — the caller maps
    that to an HTTP error and the frontend falls back to the browser voice.
    """
    text = (text or "").strip()
    if not text:
        raise TTSError("No text to speak.")
    provider = provider or settings.tts_provider

    path = _cache_path(text, provider)
    if path.exists():
        try:
            return path.read_bytes()
        except OSError:
            pass  # unreadable cache file — regenerate below

    audio = _SYNTH_BY_PROVIDER[provider](text)
    try:
        TTS_DIR.mkdir(parents=True, exist_ok=True)
        # Write atomically so a concurrent reader never sees a half-written file.
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(audio)
        tmp.replace(path)
    except OSError as exc:
        logger.warning("Could not cache TTS audio for %r: %s", text[:40], exc)
    return audio


def is_cached(text: str, provider: str | None = None) -> bool:
    """True when `text` already has audio on disk for `provider` (no synthesis)."""
    text = (text or "").strip()
    return bool(text) and _cache_path(text, provider or settings.tts_provider).exists()


def prewarm(texts: list[str], provider: str | None = None) -> tuple[int, int]:
    """Ensure every phrase in `texts` has audio on disk for `provider`.
    Best-effort: a phrase that fails is skipped and retried on the next
    prewarm. Returns (generated, total_unique)."""
    unique = list(dict.fromkeys(t.strip() for t in texts if t and t.strip()))
    generated = 0
    for t in unique:
        if is_cached(t, provider):
            continue
        try:
            synthesize(t, provider)
            generated += 1
        except TTSError as exc:
            logger.info("Prewarm skipped %r: %s", t[:40], exc)
    return generated, len(unique)


# CEFR levels routed to ElevenLabs regardless of the default provider — B1
# stories use the higher-fidelity voice, everything else stays on the free/
# offline default.
_ELEVENLABS_LEVELS = {"B1"}


def provider_for_level(cefr_level: str | None) -> str:
    """Resolve which TTS provider a listening item's audio should use, based
    on its CEFR level. Falls back to settings.tts_provider outside the
    ElevenLabs-routed levels."""
    if cefr_level and cefr_level.strip().upper() in _ELEVENLABS_LEVELS:
        return "elevenlabs"
    return settings.tts_provider
