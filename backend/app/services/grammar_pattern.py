"""Grammar-pattern spaced review — the same FSRS machinery as vocabulary,
applied to grammar structures instead of words.

A GrammarLesson's "review" cloze cards are the recall test; grading one here
creates (on first encounter) or reschedules the learner's UserGrammarCard, so
the pattern re-enters the same interleaved due-queue as everything else
instead of being forgotten the moment the lesson ends.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.grammar_pattern import GrammarPattern, UserGrammarCard
from app.services import srs as srs_service
from app.services.vocab import normalize


def grade_pattern(db: Session, user_id: uuid.UUID, pattern: GrammarPattern, answer: str) -> dict:
    """Grade one cloze answer for `pattern`, creating the user's card on first
    encounter, and reschedule it via FSRS. Correct/incorrect only (3/Good vs
    1/Again) — same binary shape as the vocab trainer's typed levels."""
    card = (
        db.query(UserGrammarCard)
        .filter(UserGrammarCard.user_id == user_id, UserGrammarCard.pattern_id == pattern.id)
        .first()
    )
    if card is None:
        card = UserGrammarCard(user_id=user_id, pattern_id=pattern.id, due_date=date.today())
        db.add(card)
        db.flush()

    correct = normalize(answer or "") == normalize(pattern.cloze_answer)
    fsrs_rating = 3 if correct else 1

    update = srs_service.schedule(
        stability=card.stability,
        difficulty=card.difficulty,
        reps=card.reps,
        lapses=card.lapses,
        state=card.state,
        rating=fsrs_rating,
        now=date.today(),
    )
    card.stability = update.stability
    card.difficulty = update.difficulty
    card.reps = update.reps
    card.lapses = update.lapses
    card.state = update.state
    card.due_date = update.due_date
    card.due_at = datetime.combine(update.due_date, time.min, tzinfo=timezone.utc)
    db.commit()

    return {"correct": correct, "cloze_answer": pattern.cloze_answer, "due_date": card.due_date}


def weakest_patterns(db: Session, user_id: uuid.UUID, *, limit: int = 3) -> list[GrammarPattern]:
    """This user's shakiest grammar patterns for the weakness-targeted Review
    lesson. UserGrammarCard carries no accuracy counters (unlike UserCard) —
    only FSRS's own lapses/difficulty — so those stand in as the weakness
    signal: most Again-ratings first, FSRS's own difficulty estimate as the
    tiebreak. Only patterns the learner has actually reviewed at least once
    (reps > 0) qualify; a brand-new UserGrammarCard's zeroed fields would
    otherwise look artificially "weak" and crowd out real signal."""
    rows = (
        db.query(UserGrammarCard, GrammarPattern)
        .join(GrammarPattern, GrammarPattern.id == UserGrammarCard.pattern_id)
        .filter(UserGrammarCard.user_id == user_id, UserGrammarCard.reps > 0)
        .all()
    )
    rows.sort(key=lambda r: (-r[0].lapses, -r[0].difficulty))
    return [pattern for _, pattern in rows[:limit]]


def grammar_dashboard_summary(db: Session, user_id: uuid.UUID) -> dict:
    """Deck-wide grammar aggregates for the Home tab's Data section —
    mirrors vocab_dashboard_summary's mature-count/hardest-words shape,
    pointed at UserGrammarCard instead of UserCard."""
    mastered_count = (
        db.query(func.count(UserGrammarCard.id))
        .filter(UserGrammarCard.user_id == user_id, UserGrammarCard.state == "review")
        .scalar()
        or 0
    )
    weakest = weakest_patterns(db, user_id, limit=1)
    return {
        "mastered_count": mastered_count,
        "weakest_structure": weakest[0].pattern if weakest else None,
    }
