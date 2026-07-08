"""Per-skill rollup tracking across the 7 dimensions the dashboard surfaces:
recognition, recall, pronunciation, listening, grammar, writing, conversation.

Each dimension already has a scoring moment somewhere in the app (a vocab
answer, a Gemini-graded writing/production check, a grammar cloze, a speaking
turn, a listening result) — this module just accumulates those outcomes into
one UserSkillStats row per (user, skill) so they can be queried later, instead
of being computed once and discarded.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.skill_stats import UserSkillStats

SKILL_RECOGNITION = "recognition"
SKILL_RECALL = "recall"
SKILL_PRONUNCIATION = "pronunciation"
SKILL_LISTENING = "listening"
SKILL_GRAMMAR = "grammar"
SKILL_WRITING = "writing"
SKILL_CONVERSATION = "conversation"

SKILLS = {
    SKILL_RECOGNITION,
    SKILL_RECALL,
    SKILL_PRONUNCIATION,
    SKILL_LISTENING,
    SKILL_GRAMMAR,
    SKILL_WRITING,
    SKILL_CONVERSATION,
}


def record_attempt(
    db: Session,
    user_id: uuid.UUID,
    skill: str,
    *,
    correct: bool | None = None,
    score: float | None = None,
    response_ms: int | None = None,
) -> UserSkillStats:
    """Increment one row of user_skill_stats for `skill`, creating it on first
    encounter. Commits on its own — callers can fire-and-forget alongside
    whatever else they're persisting in the same request."""
    assert skill in SKILLS, f"unknown skill: {skill!r}"

    row = (
        db.query(UserSkillStats)
        .filter(UserSkillStats.user_id == user_id, UserSkillStats.skill == skill)
        .first()
    )
    if row is None:
        # Column defaults only apply at flush time — set the counters explicitly
        # so the += below works immediately on a freshly-constructed row.
        row = UserSkillStats(
            user_id=user_id, skill=skill,
            attempts=0, correct_count=0, score_sum=0.0, scored_attempts=0, response_ms_total=0,
        )
        db.add(row)

    row.attempts += 1
    if correct:
        row.correct_count += 1
    if score is not None:
        row.score_sum += score
        row.scored_attempts += 1
    if response_ms is not None:
        row.response_ms_total += response_ms
    row.last_practiced_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(row)
    return row
