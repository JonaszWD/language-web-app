"""Vocabulary-training orchestration: the 5-level progression.

Levels (stored on UserCard.level):
  1  recognition   — show ES, self-rate know/shaky/no-idea
  2  guided typing — Pexels image + scrambled letters, type the word
  3  recall        — English prompt, type the ES word (no help)
  4  cloze         — ES sentence with a blank, type the word
  5  production    — write a sentence; Gemini grades it

A correct answer advances the card one level (5 = mastered). Scheduling still
flows through FSRS so cards reappear on sensible intervals.
"""
from __future__ import annotations

import logging
import random
import unicodedata
from datetime import date

from sqlalchemy.orm import Session

from app.models.user_card import UserCard
from app.models.word import Word
from app.services import enrich as enrich_service
from app.services import images as image_service
from app.services import srs as srs_service

logger = logging.getLogger("vocab")

MASTERED_LEVEL = 5
PASS_SCORE = 60  # level-5 Gemini score needed to count as correct


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalize(s: str) -> str:
    """Lower-case, trim, drop accents — for forgiving answer comparison."""
    return _strip_accents(s.strip().lower())


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


def scrambled_letters(spanish: str) -> list[str]:
    """The word's letters, shuffled — the level-2 hint."""
    letters = list(spanish.replace(" ", ""))
    random.shuffle(letters)
    return letters


def build_exercise(word: Word, level: int) -> dict:
    """The per-level payload the frontend needs to render one exercise."""
    enr = word.enrichment or {}
    # spanish is included at every level so the UI can pronounce it (audio button);
    # the exercise components never render it as text except at levels 1 and 5.
    exercise: dict = {"level": level, "spanish": word.spanish}
    if level == 1:
        exercise.update(spanish=word.spanish, english=word.english)
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
        exercise.update(
            sentence=enr.get("level4_sentence") or "",
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
    rating: str | None = None,
) -> dict:
    """Grade an answer, advance the level on success, reschedule via FSRS.

    Returns a result dict the router serializes (correct flag, new level,
    optional Gemini feedback for level 5).
    """
    level = card.level
    correct = False
    feedback: dict | None = None

    if level == 1:
        # Self-rated: know -> correct/advance, shaky -> stay (Hard), no-idea -> Again.
        correct = rating == "know"
        fsrs_rating = {"know": 3, "shaky": 2, "no_idea": 1}.get(rating or "", 1)
    elif level in (2, 3, 4):
        correct = normalize(answer or "") == normalize(word.spanish)
        fsrs_rating = 3 if correct else 1
    else:  # level 5 — Gemini evaluation
        try:
            feedback = enrich_service.evaluate_sentence(word.spanish, word.english, answer or "")
            correct = bool(feedback.get("correct_usage")) and feedback.get("score", 0) >= PASS_SCORE
        except enrich_service.EnrichmentError as exc:
            logger.warning("Level-5 eval failed: %s", exc)
            feedback = {"score": 0, "correct_usage": False,
                        "feedback": "Could not grade right now — try again.", "correction": ""}
        fsrs_rating = 3 if correct else 2

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
    db.commit()

    return {
        "correct": correct,
        "level": card.level,
        "mastered": card.level >= MASTERED_LEVEL and correct,
        "spanish": word.spanish,
        "feedback": feedback,
    }
