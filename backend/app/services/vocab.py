"""Vocabulary-training orchestration: the 5-level progression.

Levels (stored on UserCard.level):
  1  recognition   — 4-option multiple choice: pick the correct English gloss
  2  guided typing — Pexels image + scrambled letters, type the word
  3  recall        — English prompt, type the ES word (no help)
  4  cloze         — ES sentence with a blank, type the word
  5  production    — write a sentence; Gemini grades it

A correct answer advances the card one level (5 = mastered). Scheduling still
flows through FSRS so cards reappear on sensible intervals. Level 1 used to be
a self-rated know/shaky/no-idea check — replaced with a real retrieval task
because self-rated familiarity is an unreliable signal (the "fluency
illusion": people overrate how well they know something), letting weak items
slip through as "known".
"""
from __future__ import annotations

import logging
import random
import unicodedata
import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.mission import MissionVocab
from app.models.user_card import UserCard
from app.models.word import Word
from app.services import enrich as enrich_service
from app.services import images as image_service
from app.services import skill_stats as skill_stats_service
from app.services import srs as srs_service

logger = logging.getLogger("vocab")

MASTERED_LEVEL = 5
PASS_SCORE = 60  # level-5 Gemini score needed to count as correct

# A mission's Vocabulary step (or a burst within it) is considered "ready to
# advance" once every word reaches this level — not full mastery. Full mastery
# (MASTERED_LEVEL) keeps accruing asynchronously via ordinary FSRS review in the
# background, interleaved with every other mission's words. See srs_scheduling
# design notes: mastery-before-advance causes cramming, not retention.
MISSION_ADVANCE_LEVEL = 2


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalize(s: str) -> str:
    """Lower-case, drop accents, and keep only alphanumeric characters.

    Spaces, punctuation (¿ ¡ ? ! . , ' … -) and other noise are dropped so the
    grader is forgiving: the letter keyboard (whose tiles have no space) can spell
    multi-word vocab like "el café", and stray punctuation never fails an answer."""
    return "".join(c for c in _strip_accents(s.lower()) if c.isalnum())


# Spanish articles — kept in the displayed word (and letter tiles) but ignored
# when grading, so "café" and "el café" both count as correct.
_ARTICLES = {"el", "la", "los", "las", "un", "una", "unos", "unas"}


def _strip_article(s: str) -> str:
    """Drop a leading definite/indefinite article, if the word has more parts."""
    parts = s.strip().split()
    if len(parts) > 1 and _strip_accents(parts[0].lower()) in _ARTICLES:
        return " ".join(parts[1:])
    return s


def ensure_enrichment(db: Session, word: Word) -> Word:
    """Populate word.enrichment (Gemini) and word.image_url (Pexels) on first use.

    Best-effort: failures are logged and leave the field None so the UI degrades
    gracefully rather than blocking the exercise.
    """
    if word.enrichment is None:
        try:
            word.enrichment = enrich_service.enrich_word(word.spanish, word.english)
        except enrich_service.EnrichmentError as exc:
            logger.warning("Enrichment failed for %r: %s", word.spanish, exc)
    if word.image_url is None:
        word.image_url = image_service.find_image(word.english)
    db.commit()
    return word


# Confidence (0-100) implied by an answer when the client doesn't report its own
# — a correct/incorrect proxy so every attempt contributes to the running average.
def _implied_confidence(correct: bool) -> float:
    return 80.0 if correct else 30.0


def record_attempt(
    card: UserCard,
    *,
    correct: bool,
    now: datetime,
    response_ms: int | None = None,
    confidence: float | None = None,
    hints: int | None = None,
) -> None:
    """Fold one answer into the card's per-user performance counters.

    Raw counters only — ratios (accuracy, avg response time, avg confidence) are
    derived on read in card_stats(). Caller commits.
    """
    card.attempts += 1
    if correct:
        card.correct_count += 1
        card.last_success_at = now
    if response_ms is not None and response_ms >= 0:
        card.response_ms_total += int(response_ms)
    if confidence is not None:
        card.confidence_sum += float(confidence)
    card.hints_total += int(hints or 0)


def card_stats(card: UserCard, *, now: datetime | None = None) -> dict:
    """Derive the per-user performance view from the card's raw counters."""
    now = now or datetime.now(timezone.utc)
    a = card.attempts
    since = None
    if card.last_success_at is not None:
        since = (now - card.last_success_at).total_seconds()
    return {
        "attempts": a,
        "accuracy": (card.correct_count / a) if a else None,
        "avg_response_ms": (card.response_ms_total / a) if a else None,
        "avg_confidence": (card.confidence_sum / a) if a else None,
        "hints": card.hints_total,
        "seconds_since_last_success": since,
    }


def scrambled_letters(spanish: str) -> list[str]:
    """The word's letters, shuffled — the level-2 hint."""
    letters = list(spanish.replace(" ", ""))
    random.shuffle(letters)
    return letters


def apply_word_signal(db: Session, user_id: uuid.UUID, spanish: str, rating: int) -> UserCard | None:
    """Feed an FSRS rating from OUTSIDE the formal vocab trainer — e.g. a word
    the learner correctly produced unprompted during a Speaking/Final Challenge
    free conversation. That's a stronger mastery signal than a scripted answer
    and should push the review interval out (or pull it in on a miss) the same
    as any other review; ignoring it would waste the most ecologically valid
    signal the app has.

    Deliberately does not touch UserCard.level — leveling is a vocab-trainer
    concept; this only advances the shared FSRS schedule. No-ops (returns None)
    when the word isn't in the user's deck.
    """
    word = db.query(Word).filter(func.lower(Word.spanish) == spanish.strip().lower()).first()
    if word is None:
        return None
    card = (
        db.query(UserCard)
        .filter(UserCard.user_id == user_id, UserCard.word_id == word.id)
        .first()
    )
    if card is None:
        return None

    update = srs_service.schedule(
        stability=card.stability,
        difficulty=card.difficulty,
        reps=card.reps,
        lapses=card.lapses,
        state=card.state,
        rating=rating,
        now=date.today(),
    )
    card.stability = update.stability
    card.difficulty = update.difficulty
    card.reps = update.reps
    card.lapses = update.lapses
    card.state = update.state
    card.due_date = update.due_date
    card.due_at = datetime.combine(update.due_date, time.min, tzinfo=timezone.utc)

    now_dt = datetime.now(timezone.utc)
    record_attempt(card, correct=rating >= 3, now=now_dt, confidence=_implied_confidence(rating >= 3))
    db.commit()
    return card


def _distractor_options(db: Session, word: Word, mission_id: str | None, n: int = 3) -> list[str]:
    """English distractors for the level-1 recognition MCQ. Prefers the same
    mission's other words (thematically close — a harder, better test) and
    falls back to the same CEFR pool, then any other word. Degrades gracefully
    to fewer than `n` options for a thin pool (e.g. a very short mission)."""
    seen = {word.english.strip().lower()}
    picks: list[str] = []

    def _add(rows: list[tuple[str]]) -> None:
        pool = list(rows)
        random.shuffle(pool)
        for (en,) in pool:
            if len(picks) >= n:
                break
            key = (en or "").strip().lower()
            if key and key not in seen:
                seen.add(key)
                picks.append(en)

    if mission_id:
        mission_words = db.query(func.lower(MissionVocab.spanish)).filter(
            MissionVocab.mission_id == mission_id
        )
        _add(
            db.query(Word.english)
            .filter(Word.id != word.id, func.lower(Word.spanish).in_(mission_words))
            .all()
        )
    if len(picks) < n:
        _add(
            db.query(Word.english)
            .filter(Word.id != word.id, Word.cefr_level == word.cefr_level)
            .limit(50)
            .all()
        )
    if len(picks) < n:
        _add(db.query(Word.english).filter(Word.id != word.id).limit(50).all())
    return picks[:n]


def build_exercise(db: Session, word: Word, level: int, mission_id: str | None = None) -> dict:
    """The per-level payload the frontend needs to render one exercise."""
    enr = word.enrichment or {}
    # spanish is included at every level so the UI can pronounce it (audio button);
    # the exercise components never render it as text except at levels 1 and 5.
    exercise: dict = {"level": level, "spanish": word.spanish}
    if level == 1:
        # Real recall task, not a self-report: the correct gloss is shuffled
        # among distractors — `english` itself is NOT sent, since that would
        # hand the answer to the client outright.
        options = _distractor_options(db, word, mission_id) + [word.english]
        random.shuffle(options)
        exercise.update(options=options)
    elif level == 2:
        exercise.update(
            image_url=word.image_url,
            english=word.english,
            letters=scrambled_letters(word.spanish),
            length=len(word.spanish),
        )
    elif level == 3:
        exercise.update(english=enr.get("english_prompt") or word.english)
    elif level == 4:
        # Guess the word from a Spanish definition (English gloss underneath).
        exercise.update(
            description_es=enr.get("description_es") or "",
            description_en=enr.get("description_en") or "",
            english=word.english,
        )
    else:  # level 5
        exercise.update(spanish=word.spanish, english=word.english)
    return exercise


def grade(
    db: Session,
    card: UserCard,
    word: Word,
    *,
    answer: str | None = None,
    response_ms: int | None = None,
    confidence: float | None = None,
    hints: int | None = None,
) -> dict:
    """Grade an answer, advance the level on success, reschedule via FSRS.

    Also folds the attempt into the card's per-user performance stats
    (accuracy/response time/confidence/hints/attempts/last success).

    Returns a result dict the router serializes (correct flag, new level,
    optional Gemini feedback for level 5, updated stats).
    """
    level = card.level
    correct = False
    feedback: dict | None = None

    if level == 1:
        # MCQ: `answer` is the option text the learner picked.
        correct = normalize(answer or "") == normalize(word.english)
        fsrs_rating = 3 if correct else 1
    elif level in (2, 3, 4):
        # Accept the answer with or without the leading article.
        targets = {normalize(word.spanish), normalize(_strip_article(word.spanish))}
        correct = normalize(answer or "") in targets
        fsrs_rating = 3 if correct else 1
    else:  # level 5 — Gemini evaluation
        try:
            feedback = enrich_service.evaluate_sentence(word.spanish, word.english, answer or "")
            correct = bool(feedback.get("correct_usage")) and feedback.get("score", 0) >= PASS_SCORE
        except enrich_service.EnrichmentError as exc:
            logger.warning("Level-5 eval failed: %s", exc)
            feedback = {"score": 0, "correct_usage": False,
                        "feedback": "Could not grade right now — try again.", "correction": ""}
        fsrs_rating = 3 if correct else 1

    if correct and card.level < MASTERED_LEVEL:
        card.level += 1

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

    # due_at drives the training loop's next-card selection with minute precision.
    # Level 1 keeps the card inside the session: wrong comes back within a
    # minute for fast restudy, right joins the same in-session climb as levels
    # 2-4 (~10 min) so the whole 1→2→3→4→5 progression can happen in one
    # sitting. Level-5 mastery falls through to the FSRS day schedule below.
    now_dt = datetime.now(timezone.utc)
    if level == 1:
        card.due_at = now_dt + (timedelta(minutes=10) if correct else timedelta(seconds=45))
    elif level in (2, 3, 4) and correct:
        card.due_at = now_dt + timedelta(minutes=10)
    else:
        card.due_at = datetime.combine(update.due_date, time.min, tzinfo=timezone.utc)

    # Record per-user performance for this word. Confidence is derived from
    # correctness when the client doesn't report its own so every attempt counts.
    conf = confidence if confidence is not None else _implied_confidence(correct)
    record_attempt(
        card,
        correct=correct,
        now=now_dt,
        response_ms=response_ms,
        confidence=conf,
        hints=hints,
    )
    db.commit()

    # Same attempt, tagged into the cross-cutting per-skill dashboard rollup.
    # Level 1 = recognition (MCQ), 2-4 = recall (typed), 5 = writing (Gemini-graded).
    if level == 1:
        skill = skill_stats_service.SKILL_RECOGNITION
    elif level in (2, 3, 4):
        skill = skill_stats_service.SKILL_RECALL
    else:
        skill = skill_stats_service.SKILL_WRITING
    skill_stats_service.record_attempt(
        db, card.user_id, skill,
        correct=correct,
        score=feedback.get("score") if feedback else None,
        response_ms=response_ms,
    )

    return {
        "correct": correct,
        "level": card.level,
        "mastered": card.level >= MASTERED_LEVEL and correct,
        "spanish": word.spanish,
        "feedback": feedback,
        "stats": card_stats(card, now=now_dt),
    }
