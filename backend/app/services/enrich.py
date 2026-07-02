"""Google Gemini integration for vocabulary enrichment and level-5 grading.

Two jobs:
  * enrich_word()      — one cached call per word producing the rich chunk data
                         (gender, synonyms, antonyms, collocations, chunks,
                         frequency, pronunciation, common mistakes, sentences).
  * evaluate_sentence() — grades a user-written sentence at level 5.

Uses the Gemini REST API directly (httpx) with JSON response mode, so no extra
dependency is needed. Key comes from settings.gemini_key (env GEMINI_KEY).
"""
from __future__ import annotations

import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger("enrich")

_MODEL = "gemini-2.5-flash"
_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_MODEL}:generateContent"


class EnrichmentError(Exception):
    """Raised when Gemini can't be reached or returns unusable output."""


def _call(prompt: str, schema: dict) -> dict:
    key = settings.gemini_key
    if not key:
        raise EnrichmentError("Gemini is not configured. Set GEMINI_KEY in the backend environment.")

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": 0.4,
        },
    }
    try:
        resp = httpx.post(
            _URL,
            params={"key": key},
            json=payload,
            timeout=30.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise EnrichmentError(
            f"Gemini returned {exc.response.status_code}. Check the API key and quota."
        ) from exc
    except httpx.HTTPError as exc:
        raise EnrichmentError(f"Could not reach Gemini: {exc}") from exc

    try:
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise EnrichmentError(f"Gemini returned unparseable output: {exc}") from exc


_ENRICH_SCHEMA = {
    "type": "object",
    "properties": {
        "gender": {"type": "string"},          # "el" / "la" / "" for non-nouns
        "pronunciation": {"type": "string"},   # IPA
        "frequency": {"type": "string"},       # "very common" / "common" / "rare"
        "synonyms": {"type": "array", "items": {"type": "string"}},
        "antonyms": {"type": "array", "items": {"type": "string"}},
        "collocations": {"type": "array", "items": {"type": "string"}},
        "chunks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "es": {"type": "string"},
                    "en": {"type": "string"},
                },
                "required": ["es", "en"],
            },
        },
        "common_mistakes": {"type": "array", "items": {"type": "string"}},
        "english_prompt": {"type": "string"},   # concise gloss for level 3
        "level4_sentence": {"type": "string"},   # Spanish sentence with ___ where the word goes
        "example_sentences": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "es": {"type": "string"},
                    "en": {"type": "string"},
                },
                "required": ["es", "en"],
            },
        },
    },
    "required": [
        "gender", "pronunciation", "frequency", "synonyms", "antonyms",
        "collocations", "chunks", "common_mistakes", "english_prompt",
        "level4_sentence", "example_sentences",
    ],
}


def enrich_word(spanish: str, english: str) -> dict:
    """Produce the cached enrichment payload for one Spanish word.

    Teaches chunks, not isolated words: collocations and multi-word chunks are
    first-class. Raises EnrichmentError on failure (caller decides fallback).
    """
    prompt = (
        "You are a Spanish teacher building rich vocabulary material. "
        f'For the Spanish word "{spanish}" (English: "{english}"), return JSON with:\n'
        "- gender: 'el' or 'la' for nouns, empty string otherwise\n"
        "- pronunciation: IPA transcription\n"
        "- frequency: one of 'very common', 'common', 'uncommon', 'rare'\n"
        "- synonyms / antonyms: up to 4 each (empty arrays if none)\n"
        "- collocations: up to 5 natural word partnerships (e.g. for 'mesa': 'mesa redonda')\n"
        "- chunks: up to 4 useful multi-word phrases with English (e.g. 'poner la mesa' = 'to set the table')\n"
        "- common_mistakes: up to 3 frequent learner errors with this word\n"
        "- english_prompt: a short unambiguous English gloss to elicit this exact word\n"
        "- level4_sentence: one natural Spanish sentence using the word, but with the word "
        "replaced by '___'; context must make the missing word obvious\n"
        "- example_sentences: 2 example sentences (es + en) actually containing the word\n"
        "Use the exact target word, not a variant. Teach chunks, not isolated words."
    )
    return _call(prompt, _ENRICH_SCHEMA)


_EVAL_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer"},      # 0-100
        "correct_usage": {"type": "boolean"},
        "feedback": {"type": "string"},
        "correction": {"type": "string"},  # improved version, "" if none needed
    },
    "required": ["score", "correct_usage", "feedback", "correction"],
}


def evaluate_sentence(spanish: str, english: str, sentence: str) -> dict:
    """Grade a user's level-5 sentence that should use ``spanish`` correctly."""
    prompt = (
        "You are a supportive Spanish teacher grading a student sentence. "
        f'The student had to write one sentence correctly using the word "{spanish}" '
        f'(English: "{english}").\n'
        f'Student sentence: "{sentence}"\n'
        "Return JSON: score (0-100 on grammar + correct use of the target word), "
        "correct_usage (true if the target word is present and used correctly), "
        "feedback (one or two encouraging sentences, in English), and "
        "correction (an improved Spanish version, or empty string if already good)."
    )
    return _call(prompt, _EVAL_SCHEMA)
