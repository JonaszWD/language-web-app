"""ElevenLabs text-to-speech for the Speaking tab's NPC voice.

Called directly via REST. services.tts's ElevenLabs path (used for B1
listening stories) wraps this same client rather than duplicating it. The
learner's own speech is still captured by the browser's Web Speech API (see
FreeChat.tsx's useSpeechInput) — this only covers the
NPC's reply: synthesize() turns the reply text (from
services.missions.stream_speaking_turn) into audio, played back in the
browser. Uses the Flash model for low first-byte latency.
"""
from __future__ import annotations

import httpx

from app.config import settings

_TTS_URL_TMPL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
_TTS_MODEL = "eleven_flash_v2_5"


class SpeechEngineError(Exception):
    """Raised when ElevenLabs text-to-speech fails."""


def synthesize(text: str) -> bytes:
    """Synthesise `text` (Spanish) to audio (mp3 bytes) via ElevenLabs TTS."""
    if not settings.elevenlabs_api_key:
        raise SpeechEngineError("ElevenLabs is not configured. Set ELEVENLABS_API_KEY in the backend environment.")
    text = (text or "").strip()
    if not text:
        raise SpeechEngineError("No text to speak.")
    url = _TTS_URL_TMPL.format(voice_id=settings.elevenlabs_voice_id)
    try:
        resp = httpx.post(
            url,
            headers={"xi-api-key": settings.elevenlabs_api_key, "Accept": "audio/mpeg"},
            json={"text": text, "model_id": _TTS_MODEL},
            timeout=30.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise SpeechEngineError(f"ElevenLabs synthesis failed: {exc.response.status_code} {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise SpeechEngineError(f"ElevenLabs synthesis failed: {exc}") from exc

    audio = resp.content
    if not audio:
        raise SpeechEngineError("ElevenLabs produced no audio output.")
    return audio
