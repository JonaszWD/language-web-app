"""Per-skill rollup tracking across the 7 dimensions the dashboard surfaces:
recognition, recall, pronunciation, listening, grammar, writing, conversation.

Each dimension already has a scoring moment somewhere in the app (a vocab
answer, a Mistral-graded writing/production check, a grammar cloze, a speaking
turn, a listening result) — this module just accumulates those outcomes into
one UserSkillStats row per (user, skill) so they can be queried later, instead
of being computed once and discarded.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.skill_stats import UserSkillStats

# Same connection this module writes into GET /stats/dashboard's cache under
# (see routers/stats.py) — duplicated here rather than imported to avoid a
# router->service import, and because a dropped Redis connection should never
# break a write path that would otherwise succeed.
try:
    import redis as redis_lib

    _redis = redis_lib.from_url(settings.redis_url, decode_responses=True)
except Exception:
    _redis = None

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


def bust_dashboard_cache(user_id: uuid.UUID) -> None:
    """Delete GET /stats/dashboard's cached response for this user so a
    just-recorded action shows up immediately instead of waiting out the
    5-minute TTL (routers/stats.py CACHE_TTL). Every write path that feeds
    the dashboard (skill attempts, mission start/complete, session end,
    lesson-progress pings) should call this after committing."""
    if _redis is None:
        return
    try:
        _redis.delete(f"dashboard:{user_id}")
    except Exception:
        pass


def _get_or_create_row(db: Session, user_id: uuid.UUID, skill: str) -> UserSkillStats:
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
            replays_total=0, transcript_reveals_total=0, retries_total=0, recordings_total=0,
        )
        db.add(row)
    return row


def record_attempt(
    db: Session,
    user_id: uuid.UUID,
    skill: str,
    *,
    correct: bool | None = None,
    score: float | None = None,
    response_ms: int | None = None,
    retries: int = 0,
    recorded: bool = False,
) -> UserSkillStats:
    """Increment one row of user_skill_stats for `skill`, creating it on first
    encounter. Commits on its own — callers can fire-and-forget alongside
    whatever else they're persisting in the same request.

    `retries`/`recorded` are Speaking-specific (see routers/missions.py and
    routers/speaking.py turn submits) — harmless no-ops for every other skill."""
    row = _get_or_create_row(db, user_id, skill)

    row.attempts += 1
    if correct:
        row.correct_count += 1
    if score is not None:
        row.score_sum += score
        row.scored_attempts += 1
    if response_ms is not None:
        row.response_ms_total += response_ms
    if retries:
        row.retries_total += retries
    if recorded:
        row.recordings_total += 1
    row.last_practiced_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(row)
    bust_dashboard_cache(user_id)
    return row


def record_lesson_progress(
    db: Session,
    user_id: uuid.UUID,
    skill: str,
    *,
    stage: int | None = None,
    replay: bool = False,
    transcript_reveal: bool = False,
    speed: float | None = None,
) -> UserSkillStats:
    """Track engagement inside a scripted lesson (Grammar/Listening/Writing's
    hand-authored 7-stage decks) that doesn't fit record_attempt's
    right/wrong-answer shape: how far the learner got, and how much support
    (replays, transcript reveals, slower speed) they needed to get there.
    Called fire-and-forget from the frontend as the learner progresses —
    never gates or blocks the lesson."""
    row = _get_or_create_row(db, user_id, skill)

    if stage is not None:
        row.max_stage_reached = max(row.max_stage_reached or 0, stage)
    if replay:
        row.replays_total += 1
    if transcript_reveal:
        row.transcript_reveals_total += 1
    if speed is not None:
        row.last_speed_reached = speed

    db.commit()
    db.refresh(row)
    bust_dashboard_cache(user_id)
    return row


def weakest_skill(db: Session, user_id: uuid.UUID, *, min_attempts: int = 3) -> str | None:
    """The user's lowest-accuracy skill, among skills with enough attempts
    (min_attempts) to mean something — a skill with 1 attempt and a miss would
    otherwise always "win" as worst. Returns None for a learner too new to
    have any qualifying skill yet."""
    rows = (
        db.query(UserSkillStats)
        .filter(UserSkillStats.user_id == user_id, UserSkillStats.attempts >= min_attempts)
        .all()
    )
    if not rows:
        return None
    rows.sort(key=lambda r: r.correct_count / r.attempts)
    return rows[0].skill
