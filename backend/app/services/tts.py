"""Text-to-speech via Google Gemini.

Synthesises Spanish audio for the listening step. Uses the cheapest TTS model
(``gemini-2.5-flash-preview-tts``) over REST, mirroring services.enrich (key
from settings.gemini_key / env GEMINI_KEY).

Gemini returns raw 16-bit PCM (mono, usually 24 kHz). Browsers can't play bare
PCM, so we wrap it in a WAV container here.

Audio is persisted to disk (TTS_DIR, a mounted volume in prod — same pattern as
podcast audio) keyed by voice+text, so a phrase is synthesised at most once ever
and survives restarts. A mission's listening audio is pre-generated in bulk when
the mission is opened (see prewarm / routers.tts), so by the time the learner
reaches the listening step every clip is already on disk.
"""
from __future__ import annotations

import base64
import hashlib
import io
import logging
import os
import re
import struct
import wave
from pathlib import Path

import httpx

from app.config import settings

logger = logging.getLogger("tts")

# Cheapest Gemini TTS model. The "pro" variant is higher quality and pricier;
# flash is the cheapest, which is all the listening step needs.
_TTS_MODEL = "gemini-2.5-flash-preview-tts"
_TTS_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_TTS_MODEL}:generateContent"

# One of Gemini's prebuilt voices. Achird is a warm, friendly-sounding voice —
# nicer for a learner than the firmer default (Kore).
_VOICE = "Achird"

# Persistent on-disk cache. Same convention as podcast AUDIO_DIR — a named volume
# in prod so generated clips survive restarts.
TTS_DIR = Path(os.getenv("TTS_DIR", "/data/tts"))


class TTSError(Exception):
    """Raised when audio could not be synthesised."""


def _cache_path(text: str) -> Path:
    """Stable on-disk path for a phrase, keyed by voice+text so a voice change
    doesn't serve stale audio."""
    digest = hashlib.sha1(f"{_VOICE}:{text}".encode()).hexdigest()
    return TTS_DIR / f"{digest}.wav"


def _pcm_to_wav(pcm: bytes, sample_rate: int) -> bytes:
    """Wrap raw signed 16-bit mono PCM in a WAV container the browser can play."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        wav.writeframes(pcm)
    return buf.getvalue()


def _sample_rate_from_mime(mime: str) -> int:
    """Pull the sample rate out of a mime like 'audio/L16;codec=pcm;rate=24000'.
    Gemini TTS defaults to 24 kHz when unspecified."""
    m = re.search(r"rate=(\d+)", mime or "")
    return int(m.group(1)) if m else 24000


def _call_gemini_tts(text: str) -> bytes:
    """Synthesise `text` via Gemini and return WAV bytes. No caching here."""
    key = settings.gemini_key
    if not key:
        raise TTSError("Gemini is not configured. Set GEMINI_KEY in the backend environment.")

    payload = {
        # A leading style directive steers delivery without being read aloud.
        "contents": [{"parts": [{"text": f"Say this warmly and cheerfully, like a friendly teacher, in Spanish: {text}"}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {"prebuiltVoiceConfig": {"voiceName": _VOICE}},
            },
        },
    }
    try:
        resp = httpx.post(_TTS_URL, params={"key": key}, json=payload, timeout=30.0)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise TTSError(f"Gemini TTS returned {exc.response.status_code}.") from exc
    except httpx.HTTPError as exc:
        raise TTSError(f"Could not reach Gemini TTS: {exc}") from exc

    try:
        part = resp.json()["candidates"][0]["content"]["parts"][0]
        inline = part["inlineData"]
        pcm = base64.b64decode(inline["data"])
        rate = _sample_rate_from_mime(inline.get("mimeType", ""))
    except (KeyError, IndexError, ValueError, struct.error) as exc:
        raise TTSError(f"Gemini TTS returned no usable audio: {exc}") from exc

    return _pcm_to_wav(pcm, rate)


def synthesize(text: str) -> bytes:
    """Return WAV audio for `text`, spoken in Spanish. Served from the on-disk
    cache when present, otherwise synthesised and persisted first.

    Raises TTSError when Gemini is unconfigured, unreachable, or returns no
    audio — the caller maps that to an HTTP error and the frontend falls back to
    the browser voice.
    """
    text = (text or "").strip()
    if not text:
        raise TTSError("No text to speak.")

    path = _cache_path(text)
    if path.exists():
        try:
            return path.read_bytes()
        except OSError:
            pass  # unreadable cache file — regenerate below

    wav = _call_gemini_tts(text)
    try:
        TTS_DIR.mkdir(parents=True, exist_ok=True)
        # Write atomically so a concurrent reader never sees a half-written file.
        tmp = path.with_suffix(".wav.tmp")
        tmp.write_bytes(wav)
        tmp.replace(path)
    except OSError as exc:
        logger.warning("Could not cache TTS audio for %r: %s", text[:40], exc)
    return wav


def is_cached(text: str) -> bool:
    """True when `text` already has audio on disk (no synthesis)."""
    text = (text or "").strip()
    return bool(text) and _cache_path(text).exists()


def prewarm(texts: list[str]) -> tuple[int, int]:
    """Ensure every phrase in `texts` has audio on disk. Best-effort: a phrase
    that fails (e.g. Gemini 429) is skipped and retried on the next prewarm.
    Returns (generated, total_unique)."""
    unique = list(dict.fromkeys(t.strip() for t in texts if t and t.strip()))
    generated = 0
    for t in unique:
        if is_cached(t):
            continue
        try:
            synthesize(t)
            generated += 1
        except TTSError as exc:
            logger.info("Prewarm skipped %r: %s", t[:40], exc)
    return generated, len(unique)
