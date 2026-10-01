"""Mistral writing coach: feedback + style rewrites for the Writing tab.

Two jobs:
  * feedback()  — grades free writing (translation / guided / journal) and returns
                  grammar corrections, more-natural phrasings, and vocab upgrades.
  * rewrite()   — rewrites the learner's text in a chosen style
                  (more natural / formal / shorter / more Mexican / more Spanish).
"""
from __future__ import annotations

import logging

from app.services.enrich import EnrichmentError, _call

logger = logging.getLogger("writing")

_FEEDBACK_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer"},          # 0-100
        "feedback": {"type": "string"},         # short, encouraging, English
        "corrections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "wrong": {"type": "string"},
                    "correct": {"type": "string"},
                    "note": {"type": "string"},
                },
                "required": ["wrong", "correct", "note"],
            },
        },
        "natural": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "original": {"type": "string"},
                    "better": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["original", "better", "why"],
            },
        },
        "vocab_upgrades": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "from_word": {"type": "string"},
                    "to_word": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["from_word", "to_word", "why"],
            },
        },
    },
    "required": ["score", "feedback", "corrections", "natural", "vocab_upgrades"],
}


def feedback(mode: str, instructions: str, text: str) -> dict:
    """Coach a piece of writing. Raises EnrichmentError on failure."""
    prompt = (
        "You are a supportive Spanish writing coach. "
        f"Task type: {mode}. Instruction the student followed: {instructions}\n"
        f'Student wrote: "{text}"\n'
        "Return JSON with: score (0-100), feedback (1-2 encouraging English "
        "sentences), corrections (clear grammar/spelling errors: wrong fragment, "
        "correct form, one-line note), natural (phrasings that are correct but not "
        "how a native would say it: original, better, why), and vocab_upgrades "
        "(basic words worth upgrading: from_word, to_word, why). Use empty arrays "
        "where nothing applies. If this was a translation task, also flag meaning "
        "mismatches as corrections."
    )
    return _call(prompt, _FEEDBACK_SCHEMA)


_REWRITE_SCHEMA = {
    "type": "object",
    "properties": {
        "rewritten": {"type": "string"},
        "note": {"type": "string"},   # one-line English explanation of the change
    },
    "required": ["rewritten", "note"],
}

# Human-readable instruction per rewrite style key.
REWRITE_STYLES = {
    "natural": "more natural, the way a fluent native speaker would actually say it",
    "formal": "more formal and polite (usted register where relevant)",
    "shorter": "shorter and more concise, keeping the key meaning",
    "mexican": "more typical of Mexican Spanish (vocabulary and expressions)",
    "spain": "more typical of Spain Spanish (vocabulary, vosotros, expressions)",
}


def rewrite(text: str, style: str) -> dict:
    """Rewrite ``text`` in the requested style. Raises EnrichmentError on failure."""
    how = REWRITE_STYLES.get(style, REWRITE_STYLES["natural"])
    prompt = (
        "Rewrite the following Spanish text to be " + how + ". "
        "Keep the original meaning. Return JSON: rewritten (the new Spanish text) "
        "and note (one short English line explaining what you changed).\n"
        f'Text: "{text}"'
    )
    return _call(prompt, _REWRITE_SCHEMA)


_COACH_SCHEMA = {
    "type": "object",
    "properties": {
        "correct": {"type": "boolean"},
        "natural": {"type": "string"},   # the natural Spanish version
        "why": {"type": "string"},       # short reason it was off (or praise)
        "think": {"type": "string"},     # one-line intuition hint, "" if not needed
    },
    "required": ["correct", "natural", "why", "think"],
}


def coach(prompt_en: str, target_es: str, answer: str) -> dict:
    """Rich corrective feedback for one short answer (translation / production).

    Returns the natural phrasing, why the learner's version was off, and a
    thinking hint — never just "wrong". Raises EnrichmentError on failure.
    """
    prompt = (
        "You are a Spanish tutor giving corrective feedback on one short answer. "
        f"The learner should express (English meaning): \"{prompt_en}\". "
        f"A correct natural Spanish answer is: \"{target_es}\". "
        f"The learner wrote: \"{answer}\".\n"
        "Return JSON: correct (true if the learner's Spanish is acceptable), "
        "natural (the most natural Spanish way to say it), why (one short English "
        "sentence on what was off, or brief praise if correct), and think (a one-line "
        "intuition hint that reframes the structure — e.g. for 'gustar': "
        "'Coffee pleases me' — empty string if no hint is needed)."
    )
    return _call(prompt, _COACH_SCHEMA)


__all__ = ["feedback", "rewrite", "coach", "REWRITE_STYLES", "EnrichmentError"]
