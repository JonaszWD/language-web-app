"""Vocabulary enrichment and level-5 grading.

Two jobs:
  * enrich_word()      — one cached call per word producing the rich chunk data
                         (gender, synonyms, antonyms, collocations, chunks,
                         frequency, pronunciation, common mistakes, sentences).
  * evaluate_sentence() — grades a user-written sentence at level 5.

Primary provider is Google Gemini (REST via httpx, JSON response mode; key from
settings.gemini_key / env GEMINI_KEY). When Gemini fails — not configured,
unreachable, rate-limited (429), or unparseable — the call falls back to
Anthropic Claude using the cheapest model (Haiku) to keep credit spend minimal
(key from settings.claude_api_key / env CLAUDE_API_KEY). If neither provider is
configured or both fail, EnrichmentError propagates and the caller decides.
"""
from __future__ import annotations

import json
import logging
import random
import time

import anthropic
import httpx

from app.config import settings

logger = logging.getLogger("enrich")

_GEMINI_MODEL = "gemini-2.5-flash"
_GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_GEMINI_MODEL}:generateContent"

# Transient Gemini statuses worth retrying (rate-limited / server overloaded).
_RETRYABLE_STATUS = {429, 503}


def _retry_delay(resp: httpx.Response, attempt: int) -> float:
    """Backoff before the next Gemini retry. Honour a Retry-After header when
    present, otherwise exponential (1, 2, 4… s) with jitter, capped at 30s."""
    retry_after = resp.headers.get("retry-after")
    if retry_after:
        try:
            return min(float(retry_after), 30.0)
        except ValueError:
            pass
    return min(2.0 ** attempt + random.uniform(0, 0.5), 30.0)

# Cheapest Claude model — fallback only, so keep spend minimal.
_CLAUDE_MODEL = "claude-haiku-4-5"

_claude_client: anthropic.Anthropic | None = None


class EnrichmentError(Exception):
    """Raised when no provider can produce usable output."""


def _call_gemini(prompt: str, schema: dict) -> dict:
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
    # Retry transient rate-limit/overload responses with exponential backoff
    # before giving up (and letting the caller fall back to Claude).
    resp: httpx.Response | None = None
    for attempt in range(settings.gemini_max_retries + 1):
        try:
            resp = httpx.post(_GEMINI_URL, params={"key": key}, json=payload, timeout=30.0)
            resp.raise_for_status()
            break
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in _RETRYABLE_STATUS and attempt < settings.gemini_max_retries:
                delay = _retry_delay(exc.response, attempt)
                logger.info(
                    "Gemini %s (rate-limited/overloaded) — retry %d/%d in %.1fs",
                    status, attempt + 1, settings.gemini_max_retries, delay,
                )
                time.sleep(delay)
                continue
            raise EnrichmentError(
                f"Gemini returned {status}. Check the API key and quota."
            ) from exc
        except httpx.HTTPError as exc:
            raise EnrichmentError(f"Could not reach Gemini: {exc}") from exc
    if resp is None:  # exhausted retries without a usable response
        raise EnrichmentError("Gemini rate-limited after retries.")

    try:
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise EnrichmentError(f"Gemini returned unparseable output: {exc}") from exc


def _strict(schema: dict) -> dict:
    """Copy of a JSON schema with additionalProperties:false on every object
    node — required by Claude's structured-output format."""
    if not isinstance(schema, dict):
        return schema
    out = {k: (_strict(v) if k not in ("properties", "items") else v) for k, v in schema.items()}
    if isinstance(schema.get("items"), dict):
        out["items"] = _strict(schema["items"])
    if isinstance(schema.get("properties"), dict):
        out["properties"] = {k: _strict(v) for k, v in schema["properties"].items()}
    if out.get("type") == "object":
        out["additionalProperties"] = False
    return out


def _call_claude(prompt: str, schema: dict) -> dict:
    global _claude_client
    key = settings.claude_api_key
    if not key:
        raise EnrichmentError("Claude is not configured. Set CLAUDE_API_KEY in the backend environment.")
    if _claude_client is None:
        _claude_client = anthropic.Anthropic(api_key=key)

    try:
        resp = _claude_client.messages.create(
            model=_CLAUDE_MODEL,
            max_tokens=3500,
            messages=[{"role": "user", "content": prompt}],
            output_config={"format": {"type": "json_schema", "schema": _strict(schema)}},
        )
    except anthropic.APIStatusError as exc:
        raise EnrichmentError(f"Claude returned {exc.status_code}. Check the API key and quota.") from exc
    except anthropic.APIError as exc:
        raise EnrichmentError(f"Could not reach Claude: {exc}") from exc

    try:
        text = next(b.text for b in resp.content if b.type == "text")
        return json.loads(text)
    except (StopIteration, json.JSONDecodeError) as exc:
        raise EnrichmentError(f"Claude returned unparseable output: {exc}") from exc


def _call(prompt: str, schema: dict) -> dict:
    """Gemini first; fall back to Claude (Haiku) on any Gemini failure."""
    try:
        return _call_gemini(prompt, schema)
    except EnrichmentError as gemini_exc:
        if not settings.claude_api_key:
            raise
        logger.info("Gemini failed (%s) — falling back to Claude", gemini_exc)
        try:
            return _call_claude(prompt, schema)
        except EnrichmentError as claude_exc:
            raise EnrichmentError(
                f"Both providers failed. Gemini: {gemini_exc}. Claude: {claude_exc}"
            ) from claude_exc


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
        "level4_sentence": {"type": "string"},   # (legacy) Spanish sentence with ___ where the word goes
        "description_es": {"type": "string"},    # Spanish definition NOT containing the word (level 4)
        "description_en": {"type": "string"},    # English translation of description_es
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
        "level4_sentence", "description_es", "description_en", "example_sentences",
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
        "- description_es: a short Spanish definition/description of the word (like a dictionary "
        "gloss, e.g. for 'por favor': 'expresión de cortesía que se usa para pedir algo educadamente'). "
        "It MUST NOT contain the word itself or any of its forms.\n"
        "- description_en: the English translation of description_es\n"
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


# ── Speaking role-play (per-mission, 7 progressive stages) ───────────────────

# One stage. Every field is required for structured-output robustness; the model
# fills "" / [] / 0 for fields that don't apply to a given stage type.
_SPEAKING_STAGE = {
    "type": "object",
    "properties": {
        "n": {"type": "integer"},           # 1..7
        "type": {"type": "string"},         # repeat|choice|fill|prompt|dynamic|branch|free
        "title": {"type": "string"},        # 2-4 word English label
        "npc": {"type": "string"},          # NPC's Spanish line
        "npc_en": {"type": "string"},
        "instruction": {"type": "string"},  # what the learner should do (English)
        "target": {"type": "string"},       # model sentence to produce (Spanish)
        "target_en": {"type": "string"},
        "hint": {"type": "string"},         # crutch — full (stage 1) or first word (stage 4)
        "cue_en": {"type": "string"},       # English cue for prompt-based production (stage 4)
        # Every acceptable spoken answer for open stages (prompt). Lets the learner
        # communicate a real meaning ("say where you're from") rather than recite one
        # exact sentence — any of these passes. target is just the canonical one.
        "valid": {"type": "array", "items": {"type": "string"}},
        "goal": {"type": "string"},         # English objective for free stages (5-7)
        "max_turns": {"type": "integer"},   # conversation length for free stages
        "options": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "es": {"type": "string"},
                    "ok": {"type": "boolean"},
                },
                "required": ["es", "ok"],
            },
        },
        "segments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},    # literal text when blank=false
                    "blank": {"type": "boolean"},
                    "answer": {"type": "string"},  # correct word when blank=true
                    "options": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["text", "blank", "answer", "options"],
            },
        },
    },
    "required": [
        "n", "type", "title", "npc", "npc_en", "instruction", "target",
        "target_en", "hint", "cue_en", "valid", "goal", "max_turns", "options", "segments",
    ],
}

_SPEAKING_SCHEMA = {
    "type": "object",
    "properties": {
        "role": {"type": "string"},      # NPC role in Spanish, e.g. "camarero"
        "role_en": {"type": "string"},
        "setting": {"type": "string"},   # short English scene phrase
        "stages": {"type": "array", "items": _SPEAKING_STAGE},
    },
    "required": ["role", "role_en", "setting", "stages"],
}


def generate_speaking_script(title: str, description: str, vocab: list[tuple[str, str]]) -> dict:
    """Design the 7-stage progressive speaking role-play for one mission.

    ``vocab`` is a list of (spanish, english) pairs the learner has studied — the
    role-play reuses these plus basic connectors, never new grammar.
    """
    vocab_lines = "\n".join(f"- {es} = {en}" for es, en in vocab)
    prompt = (
        "You design a progressive SPEAKING role-play for a Spanish learner. "
        f'Scenario: "{title}". {description}\n'
        "The learner practises PRODUCING spoken Spanish inside this real-world scene, "
        "talking to a single NPC. Reuse ONLY the studied words below plus basic "
        "connectors (un, el, la, con, por favor, hola, adios, ...). Keep all Spanish "
        "natural and A1-A2.\n\n"
        f"Studied vocabulary:\n{vocab_lines}\n\n"
        "DESIGN THE WHOLE THING AS ONE SHORT REAL CONVERSATION for this scenario, then "
        "teach it as 7 CUMULATIVE building blocks. Decide the exchange first (a natural "
        "back-and-forth of ~5-6 lines: the NPC and the learner alternating). Each stage "
        "teaches ONE new line of that same conversation, in order, so by the end the "
        "learner can hold the whole thing.\n"
        "TWO HARD RULES:\n"
        "1. INSTRUCTION MUST MATCH THE TASK. The learner's job (instruction / cue_en / "
        "goal) must describe EXACTLY what they should say (target). And npc must be the "
        "line that naturally elicits that target. If the target is a QUESTION the learner "
        "asks, npc must be the NPC's line that prompts the learner to ask it (e.g. the NPC "
        "states their own name so the learner asks '¿Cómo te llamas?'), NOT a question the "
        "NPC already asked. Never make the learner answer a question that was not asked.\n"
        "2. LATER STAGES = COMMUNICATE, NOT RECITE. Early stages give full crutches; later "
        "stages give an intent and accept ANY correct phrasing.\n\n"
        "Return JSON: role (NPC role in Spanish, e.g. 'camarero'), role_en, setting (short "
        "English phrase), and EXACTLY 7 stages (n=1..7). Set ALL fields on every stage; use "
        "\"\" for strings, [] for arrays and 0 for max_turns where a field does not apply. "
        "title = a 2-4 word English label.\n"
        "Stage 1 'repeat' — greeting/opening, safe start. npc/npc_en = NPC's first line. "
        "instruction describes the reply. target/target_en = the learner's line. hint = the "
        "full target shown as a crutch. valid = [target].\n"
        "Stage 2 'choice' — the next line. npc asks it. options = 3 short phrases, EXACTLY 2 "
        "ok=true (both natural) and 1 ok=false (plausible but wrong). instruction = 'Choose a "
        "correct reply and say it aloud'.\n"
        "Stage 3 'fill' — the next line, assembled. npc models/prompts it. segments = the "
        "target split in order; fixed pieces blank=false with text (answer=\"\", options=[]); "
        "EXACTLY 2 pieces blank=true with text=\"\", answer=the word, options=3 words incl. "
        "the answer. target = the full sentence.\n"
        "Stage 4 'prompt' — the next line, from memory and COMMUNICATIVE. cue_en = a real "
        "instruction of MEANING, not the words (e.g. 'Tell them where you are from'). "
        "target/target_en = the most typical answer. valid = 2-4 genuinely acceptable spoken "
        "answers (e.g. ['Soy de Mexico','Soy de Espana','Soy de Colombia']). hint = the first "
        "word + '...'. No full sentence shown.\n"
        "Stage 5 'dynamic' — a small live exchange. npc/npc_en = a line that asks something "
        "the learner has PRACTISED in stages 1-4. goal = short English objective naming that "
        "exchange (e.g. 'answer how you are, then ask their name'). max_turns = 4.\n"
        "Stage 6 'branch' — a real fork. npc/npc_en = a forking question with 2-3 legitimately "
        "different answers (e.g. '¿Aqui o para llevar?'). options = each valid reply, ok=true. "
        "goal = English objective. max_turns = 3.\n"
        "Stage 7 'free' — the FULL conversation, no crutches. npc/npc_en = a simple opening. "
        "goal = English objective that lists every building block from stages 1-6 the learner "
        "should now handle (greet, give/ask name, say origin, close, etc.) AND states the NPC "
        "may vary the order or ask something unexpected, so the learner adapts. max_turns = 8."
    )
    return _call(prompt, _SPEAKING_SCHEMA)


_SPEAK_EVAL_SCHEMA = {
    "type": "object",
    "properties": {
        "understood": {"type": "boolean"},
        "npc_reply": {"type": "string"},
        "npc_reply_en": {"type": "string"},
        "correction": {"type": "string"},
        "done": {"type": "boolean"},
        "words_used": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["understood", "npc_reply", "npc_reply_en", "correction", "done", "words_used"],
}


def evaluate_speaking_turn(
    role: str,
    setting: str,
    goal: str,
    history: list[tuple[str, str]],
    utterance: str,
    vocab: list[str] | None = None,
) -> dict:
    """Play the NPC and judge one learner utterance in a free-conversation stage.

    ``history`` is a list of (speaker, text) where speaker is "npc" or "learner".
    ``vocab`` is the mission's studied Spanish words — a spontaneous, correct use
    of one of these is a stronger mastery signal than a scripted drill answer,
    so it's fed back into the word's own spaced-review schedule (see
    services.vocab.apply_word_signal), not just judged for this turn.
    """
    convo = "\n".join(
        f"{'NPC' if who == 'npc' else 'Learner'}: {text}" for who, text in history
    )
    vocab_line = (
        f"Studied vocabulary for this mission: {', '.join(vocab)}.\n" if vocab else ""
    )
    prompt = (
        f"You are role-playing as a {role} in {setting}, talking with a Spanish learner. "
        "Stay fully in character — never explain grammar or break role mid-conversation. "
        f"The learner's goal for this scene: {goal}.\n"
        f"{vocab_line}"
        f"Conversation so far:\n{convo or '(none yet)'}\n"
        f'The learner just said: "{utterance}"\n\n'
        "Drive a REAL conversation, do not wait to be led: after the learner responds, take "
        "the next natural turn yourself (ask the next question, react, or move the scene on). "
        "You may vary the order of what you ask and occasionally ask something unexpected but "
        "still answerable with the studied vocabulary, so the learner adapts rather than "
        "recites. When the interaction has run its natural course, close it with a goodbye.\n"
        "Return JSON:\n"
        "- understood: true if their Spanish was intelligible and moved toward the goal "
        "(be lenient with minor errors, accents and word order).\n"
        "- npc_reply: your next in-character line IN SPANISH, one short sentence. If "
        "understood, continue the conversation with your next turn; if not, gently "
        "reformulate/confirm (e.g. 'Entendido. Quisiera un café, ¿correcto?').\n"
        "- npc_reply_en: English translation of npc_reply.\n"
        "- correction: if the learner made a notable error, a short kind natural Spanish "
        "rephrase of what they should have said; otherwise \"\".\n"
        "- done: true ONLY when the learner has fully accomplished the goal and the scene "
        "can close.\n"
        "- words_used: which of the studied vocabulary words above the learner correctly "
        "and spontaneously used in their utterance just now (exact spellings from the "
        "list, [] if none or if no vocabulary list was given)."
    )
    return _call(prompt, _SPEAK_EVAL_SCHEMA)
