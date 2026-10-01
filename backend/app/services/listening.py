"""Checkpointed narrative listening — serving items and the FSRS feedback loop.

A wrong checkpoint answer pushes its linked_concept (a vocab word or grammar
pattern) back into the SAME review queue /study/due and /study/due-grammar
already read from. No FSRS math lives here — everything funnels through
services.srs.schedule() via vocab.apply_word_signal() (words) or the same
create-then-schedule pattern services.grammar_pattern.grade_pattern() uses
(grammar), exactly like every other write path in the app.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import case
from sqlalchemy.orm import Session

from app.models.grammar_pattern import GrammarPattern, UserGrammarCard
from app.models.listening_item import (
    CHECKPOINT_INFERENCE,
    CHECKPOINT_VOCAB_IN_CONTEXT,
    CONCEPT_GRAMMAR_PATTERN,
    CONCEPT_VOCAB,
    ListeningCheckpoint,
    ListeningItem,
    UserListeningResult,
)
from app.services import skill_stats as skill_stats_service
from app.services import srs as srs_service
from app.services import vocab as vocab_service

# Missed-answer FSRS signal — same "Again" rating every other wrong-answer path
# in the app sends (grade_pattern, vocab.grade's fsrs_rating=1 branch).
AGAIN_RATING = 1

# Easiest-first ordering for the standalone Listening tab's picker — unknown/
# non-CEFR levels sort last rather than erroring.
_CEFR_ORDER = {level: i for i, level in enumerate(["A1", "A2", "B1", "B2", "C1", "C2"])}
_CEFR_SORT_KEY = case(_CEFR_ORDER, value=ListeningItem.cefr_level, else_=len(_CEFR_ORDER))


def list_items(db: Session, *, scenario_tag: str | None = None, cefr_level: str | None = None) -> list[ListeningItem]:
    q = db.query(ListeningItem)
    if scenario_tag is not None:
        q = q.filter(ListeningItem.scenario_tag == scenario_tag)
    else:
        # Unscoped browse (standalone Listening tab picker) shows items with no
        # mission tie — mission-scoped items surface only inside that mission.
        q = q.filter(ListeningItem.scenario_tag.is_(None))
    if cefr_level:
        q = q.filter(ListeningItem.cefr_level == cefr_level)
    return q.order_by(_CEFR_SORT_KEY, ListeningItem.title).all()


def get_item(db: Session, item_id: str) -> ListeningItem | None:
    return db.query(ListeningItem).filter(ListeningItem.id == item_id).first()


def _push_grammar_pattern(db: Session, user_id: uuid.UUID, scenario_tag: str | None, pattern_text: str) -> bool:
    """Push a missed grammar pattern into review, matched by its text (a
    checkpoint's linked_concept_id — see services.mission_gen story generation,
    which has no DB-assigned pattern id to reference at generation time)."""
    q = db.query(GrammarPattern).filter(GrammarPattern.pattern == pattern_text)
    if scenario_tag:
        q = q.filter(GrammarPattern.mission_id == scenario_tag)
    pattern = q.first()
    if pattern is None:
        return False

    card = (
        db.query(UserGrammarCard)
        .filter(UserGrammarCard.user_id == user_id, UserGrammarCard.pattern_id == pattern.id)
        .first()
    )
    if card is None:
        card = UserGrammarCard(user_id=user_id, pattern_id=pattern.id, due_date=date.today())
        db.add(card)
        db.flush()

    update = srs_service.schedule(
        stability=card.stability, difficulty=card.difficulty, reps=card.reps,
        lapses=card.lapses, state=card.state, rating=AGAIN_RATING, now=date.today(),
    )
    card.stability = update.stability
    card.difficulty = update.difficulty
    card.reps = update.reps
    card.lapses = update.lapses
    card.state = update.state
    card.due_date = update.due_date
    card.due_at = datetime.combine(update.due_date, time.min, tzinfo=timezone.utc)
    db.commit()
    return True


def record_checkpoint_result(
    db: Session, user_id: uuid.UUID, checkpoint: ListeningCheckpoint, *, correct: bool
) -> dict:
    """Grade the side-effects of one checkpoint answer: push the linked concept
    back into FSRS review on a miss (Step 3), and tag the attempt into the Home
    skill-breakdown bar (Step 4) — always 'listening', plus a second skill for
    checkpoint types that specifically probe recall or grammar, matching the
    existing multi-record_attempt-calls-per-event pattern already used by
    speaking.py/missions.py for one turn contributing to two skill bars.
    """
    pushed = False
    if not correct and checkpoint.linked_concept_id:
        item = checkpoint.item
        if checkpoint.linked_concept_type == CONCEPT_VOCAB:
            card = vocab_service.apply_word_signal(
                db, user_id, checkpoint.linked_concept_id, AGAIN_RATING, create_if_missing=True
            )
            pushed = card is not None
        elif checkpoint.linked_concept_type == CONCEPT_GRAMMAR_PATTERN:
            pushed = _push_grammar_pattern(db, user_id, item.scenario_tag, checkpoint.linked_concept_id)

    skill_stats_service.record_attempt(db, user_id, skill_stats_service.SKILL_LISTENING, correct=correct)
    if checkpoint.type == CHECKPOINT_VOCAB_IN_CONTEXT:
        skill_stats_service.record_attempt(db, user_id, skill_stats_service.SKILL_RECALL, correct=correct)
    elif checkpoint.type == CHECKPOINT_INFERENCE:
        skill_stats_service.record_attempt(db, user_id, skill_stats_service.SKILL_GRAMMAR, correct=correct)

    return {"correct": correct, "pushed_to_review": pushed}


def complete_item(
    db: Session, user_id: uuid.UUID, item_id: str, *,
    comprehension_score: float, checkpoints_correct: int, checkpoints_total: int,
    replays_used: int = 0, transcript_reveals: int = 0, speed_reached: float | None = None,
) -> UserListeningResult:
    """Upsert this user's outcome for the item — latest attempt only (matches
    the one-row-per-key convention UserSkillStats already uses)."""
    result = (
        db.query(UserListeningResult)
        .filter(UserListeningResult.user_id == user_id, UserListeningResult.item_id == item_id)
        .first()
    )
    if result is None:
        result = UserListeningResult(user_id=user_id, item_id=item_id)
        db.add(result)
    result.comprehension_score = comprehension_score
    result.checkpoints_correct = checkpoints_correct
    result.checkpoints_total = checkpoints_total
    result.completed_at = datetime.now(timezone.utc)
    result.replays_used = replays_used
    result.transcript_reveals = transcript_reveals
    result.speed_reached = speed_reached
    db.commit()
    db.refresh(result)
    skill_stats_service.bust_dashboard_cache(user_id)
    return result
