"""Gemini grammar coaching: grades free-form production at the final stage.

Used by the Grammar flow's "Produce" step — the learner writes a few sentences
following an instruction (e.g. "describe your morning, use 5 present-tense verbs")
and Gemini returns a score, the target verbs it found, and inline corrections.
"""
from __future__ import annotations

import logging

from app.services.enrich import EnrichmentError, _call

logger = logging.getLogger("grammar")

_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer"},          # 0-100
        "meets_requirement": {"type": "boolean"},
        "feedback": {"type": "string"},         # short, encouraging, English
        "verbs_used": {"type": "array", "items": {"type": "string"}},
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
    },
    "required": ["score", "meets_requirement", "feedback", "verbs_used", "corrections"],
}


def check_production(topic: str, instructions: str, text: str) -> dict:
    """Grade a learner's production paragraph for one grammar focus.

    Raises EnrichmentError on failure (router maps to 502)."""
    prompt = (
        "You are a supportive Spanish teacher grading a short writing exercise.\n"
        f"Grammar focus: {topic}\n"
        f"Instruction the student followed: {instructions}\n"
        f'Student wrote: "{text}"\n'
        "Return JSON: score (0-100 for grammar + meeting the instruction), "
        "meets_requirement (true if the instruction — e.g. a required number of "
        "verbs in the target tense — is satisfied), feedback (1-2 encouraging "
        "English sentences), verbs_used (the relevant target-tense verbs you found, "
        "as written), and corrections (each mistake: the wrong fragment, the "
        "correct form, and a one-line note why). Empty corrections array if flawless."
    )
    return _call(prompt, _SCHEMA)


__all__ = ["check_production", "EnrichmentError"]
