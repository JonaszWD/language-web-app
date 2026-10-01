"""Continuous two-voice audio for long-form listening stories, via ElevenLabs'
Text to Dialogue API (POST /v1/text-to-dialogue) — one request handles a whole
batch of speaker turns, so the story plays as one uninterrupted conversation
rather than sentence-by-sentence clips stitched together at playback time (the
approach services.tts uses for every other story).

The API caps a single request at ~2000 characters across all inputs[].text, so
a full ~10-minute story (well over that) is still split into as few requests as
possible — batches of consecutive turns packed up to the character budget, not
one request per line — and the resulting audio chunks are concatenated into one
file. Two ElevenLabs voices are used: the first speaker to appear in the
transcript gets settings.elevenlabs_voice_id, the second gets
settings.elevenlabs_voice_id_secondary (any further speakers cycle between the
two — long-form stories are two-person conversations in practice).

Result is cached to disk once per item (TTS_DIR/story-{item_id}.mp3, same
volume as services.tts) — regenerating a ~10 minute story is slow and costs
real ElevenLabs quota, so this is generate-once, serve-forever like every other
TTS cache in the app.
"""
from __future__ import annotations

import logging
from pathlib import Path

import httpx

from app.config import settings
from app.services.tts import TTS_DIR

logger = logging.getLogger("story_audio")

_DIALOGUE_URL = "https://api.elevenlabs.io/v1/text-to-dialogue"
_MODEL_ID = "eleven_v3"
# Stay comfortably under ElevenLabs' ~2000-char-per-request cap.
_CHAR_BUDGET = 1800


class StoryAudioError(Exception):
    """Raised when a long-form story's audio could not be synthesised."""


def _cache_path(item_id: str) -> Path:
    return TTS_DIR / f"story-{item_id}.mp3"


def is_cached(item_id: str) -> bool:
    return _cache_path(item_id).exists()


def _voice_map(sentences: list[dict]) -> dict[str, str]:
    """First speaker to appear -> the primary voice, second -> the secondary
    voice, any further distinct speakers cycle between the two."""
    voices = [settings.elevenlabs_voice_id, settings.elevenlabs_voice_id_secondary]
    mapping: dict[str, str] = {}
    for s in sentences:
        speaker = s["speaker"]
        if speaker not in mapping:
            mapping[speaker] = voices[len(mapping) % len(voices)]
    return mapping


def _chunk_inputs(sentences: list[dict], voice_of: dict[str, str]) -> list[list[dict]]:
    """Pack consecutive turns into as few batches as possible, each kept under
    the per-request character budget — never splitting a single turn."""
    batches: list[list[dict]] = []
    current: list[dict] = []
    current_len = 0
    for s in sentences:
        text = s["text_es"]
        if current and current_len + len(text) > _CHAR_BUDGET:
            batches.append(current)
            current = []
            current_len = 0
        current.append({"text": text, "voice_id": voice_of[s["speaker"]]})
        current_len += len(text)
    if current:
        batches.append(current)
    return batches


def _call_dialogue(inputs: list[dict]) -> bytes:
    if not settings.elevenlabs_api_key:
        raise StoryAudioError("ElevenLabs is not configured. Set ELEVENLABS_API_KEY in the backend environment.")
    try:
        resp = httpx.post(
            _DIALOGUE_URL,
            headers={"xi-api-key": settings.elevenlabs_api_key, "Accept": "audio/mpeg"},
            json={"inputs": inputs, "model_id": _MODEL_ID},
            timeout=120.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise StoryAudioError(f"ElevenLabs dialogue synthesis failed: {exc.response.status_code} {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise StoryAudioError(f"ElevenLabs dialogue synthesis failed: {exc}") from exc
    audio = resp.content
    if not audio:
        raise StoryAudioError("ElevenLabs produced no audio output.")
    return audio


def generate(item_id: str, sentences: list[dict]) -> bytes:
    """Synthesise a story's full transcript as one continuous two-voice audio
    track, across as few ElevenLabs requests as the character budget allows,
    and persist the concatenated result to disk. Takes plain data (not the
    ORM row) so it's safe to run from a BackgroundTask after the request's
    DB session has closed."""
    if not sentences:
        raise StoryAudioError("Story has no sentences to synthesise.")
    voice_of = _voice_map(sentences)
    batches = _chunk_inputs(sentences, voice_of)

    chunks = [_call_dialogue(batch) for batch in batches]
    audio = b"".join(chunks)

    path = _cache_path(item_id)
    try:
        TTS_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(audio)
        tmp.replace(path)
    except OSError as exc:
        logger.warning("Could not cache story audio for %r: %s", item_id, exc)
    return audio


def get_or_generate(item_id: str, sentences: list[dict]) -> bytes:
    path = _cache_path(item_id)
    if path.exists():
        try:
            return path.read_bytes()
        except OSError:
            pass  # unreadable cache file — regenerate below
    return generate(item_id, sentences)
