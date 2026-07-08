import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.mission import MissionVocab
from app.models.user import User
from app.models.user_card import UserCard
from app.models.word import Word
from app.schemas.vocab import (
    SavedWordResponse,
    SaveWordRequest,
    VocabAnswerRequest,
    VocabAnswerResponse,
    VocabCardResponse,
    VocabDetailResponse,
    VocabListItem,
)
from app.services import vocab as vocab_service
from app.services.translate import TranslationError, translate_es_en

router = APIRouter(prefix="/vocab", tags=["vocab"])

# Enrichment fields surfaced as the "teach chunks, not words" tip strip.
_TIP_KEYS = (
    "gender", "pronunciation", "frequency", "synonyms", "antonyms",
    "collocations", "chunks", "common_mistakes", "example_sentences",
)


def _tips(word: Word, mission_example: str | None = None) -> dict:
    enr = word.enrichment or {}
    tips = {k: enr[k] for k in _TIP_KEYS if k in enr}
    if mission_example:
        # The current mission's own example takes priority over whichever
        # mission's sentence happened to get denormalised onto the shared Word
        # first (see services/missions.py:_backfill_word) — two missions can
        # share a spelling with a different sense/collocation, and a stale
        # example would make the exercise ambiguous about which one is meant.
        existing = enr.get("example_sentences") or []
        tips["example_sentences"] = [{"es": mission_example, "en": ""}] + [
            s for s in existing if s.get("es") != mission_example
        ]
    return tips


@router.post("/save", response_model=SavedWordResponse)
def save_word(
    body: SaveWordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Translate a Spanish word via DeepL and add it to the user's study deck.

    Idempotent: a word already in the user's deck is returned with ``added=False``
    and no duplicate card or extra DeepL call is made.
    """
    spanish = body.spanish.strip().lower()
    if not spanish:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No word provided."
        )

    # Reuse an existing dictionary entry (avoids a needless DeepL call); otherwise
    # translate once and store it so future taps are instant for everyone.
    word = db.query(Word).filter(func.lower(Word.spanish) == spanish).first()
    if word is None:
        try:
            english = translate_es_en(spanish)
        except TranslationError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
            ) from exc
        word = Word(
            spanish=spanish,
            english=english,
            example_sentence=body.context,
            category="Saved",
            cefr_level="?",
        )
        db.add(word)
        db.flush()

    card = (
        db.query(UserCard)
        .filter(UserCard.user_id == current_user.id, UserCard.word_id == word.id)
        .first()
    )
    added = False
    if card is None:
        card = UserCard(
            user_id=current_user.id,
            word_id=word.id,
            due_date=date.today(),
            state="new",
        )
        db.add(card)
        added = True

    db.commit()
    return SavedWordResponse(
        word_id=word.id, spanish=word.spanish, english=word.english, added=added
    )


@router.get("/cards", response_model=list[VocabListItem])
def list_vocab_cards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The user's saved-word collection with each card's training level.

    Ordered lowest-level first (words needing most work surface at the top)."""
    today = date.today()
    rows = (
        db.query(UserCard, Word)
        .join(Word, Word.id == UserCard.word_id)
        .filter(UserCard.user_id == current_user.id)
        .order_by(UserCard.level.asc(), UserCard.due_date.asc())
        .all()
    )
    return [
        VocabListItem(
            card_id=card.id,
            word_id=word.id,
            spanish=word.spanish,
            english=word.english,
            cefr_level=word.cefr_level,
            level=card.level,
            due=card.due_date <= today,
        )
        for card, word in rows
    ]


@router.get("/cards/{card_id}", response_model=VocabDetailResponse)
def vocab_card_detail(
    card_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Read-only detail for one saved word — all enrichment, no scheduling change."""
    card = (
        db.query(UserCard)
        .filter(UserCard.id == card_id, UserCard.user_id == current_user.id)
        .first()
    )
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    word = db.query(Word).filter(Word.id == card.word_id).first()
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word missing")

    vocab_service.ensure_enrichment(db, word)
    return VocabDetailResponse(
        card_id=card.id,
        word_id=word.id,
        spanish=word.spanish,
        english=word.english,
        cefr_level=word.cefr_level,
        level=card.level,
        tips=_tips(word),
        stats=vocab_service.card_stats(card),
    )


@router.get("/next", response_model=VocabCardResponse | None)
def next_vocab_card(
    mission_id: str | None = Query(default=None),
    words: str | None = Query(
        default=None,
        description="Comma-separated spanish terms — further restricts the pool "
        "to this subset (e.g. one burst of a mission's vocab).",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The next vocabulary-training item: oldest-due card still in training,
    lowest level first. Returns null when nothing is due.

    When ``mission_id`` is given, the pool is restricted to that mission's words
    so the mission's Vocabulary step trains exactly its vocabulary — using the
    same card/level machinery as the Vocabulary tab. ``words`` narrows that pool
    further to an explicit subset (a burst), so a mission can be split into
    smaller interleaved chunks instead of training all its vocab at once. In a
    mission, if nothing is due right now but a card is coming up soon (a
    requeued word), that soonest card is shown early rather than ending the
    session.
    """
    now = datetime.now(timezone.utc)
    word_subset = (
        {w.strip().lower() for w in words.split(",") if w.strip()} if words else None
    )

    def pool():
        q = db.query(UserCard).filter(UserCard.user_id == current_user.id)
        if mission_id:
            mission_words = db.query(func.lower(MissionVocab.spanish)).filter(
                MissionVocab.mission_id == mission_id
            )
            q = q.join(Word, Word.id == UserCard.word_id).filter(
                func.lower(Word.spanish).in_(mission_words)
            )
        elif word_subset:
            q = q.join(Word, Word.id == UserCard.word_id)
        if word_subset:
            q = q.filter(func.lower(Word.spanish).in_(word_subset))
        return q

    card = (
        pool()
        .filter(UserCard.due_at <= now)
        .order_by(UserCard.level.asc(), UserCard.due_at.asc())
        .first()
    )
    if card is None and mission_id:
        # Nothing due now — surface the soonest upcoming in-session card (requeued
        # within the training horizon) so "I know it"/"shaky" words reappear early
        # when the deck would otherwise be empty. Cards pushed out to a future day
        # (FSRS review) are excluded, so the session still ends when only those remain.
        card = (
            pool()
            .filter(UserCard.due_at <= now + timedelta(minutes=20))
            .order_by(UserCard.due_at.asc(), UserCard.level.asc())
            .first()
        )
    if card is None:
        return None

    word = db.query(Word).filter(Word.id == card.word_id).first()
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word missing")

    vocab_service.ensure_enrichment(db, word)
    mission_example = None
    if mission_id:
        mv = (
            db.query(MissionVocab.example_sentence)
            .filter(
                MissionVocab.mission_id == mission_id,
                func.lower(MissionVocab.spanish) == word.spanish.strip().lower(),
            )
            .first()
        )
        mission_example = mv[0] if mv else None
    return VocabCardResponse(
        card_id=card.id,
        word_id=word.id,
        level=card.level,
        exercise=vocab_service.build_exercise(db, word, card.level, mission_id),
        tips=_tips(word, mission_example),
    )


@router.post("/answer", response_model=VocabAnswerResponse)
def answer_vocab_card(
    body: VocabAnswerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grade a level answer, advance the card on success, reschedule via FSRS."""
    card = (
        db.query(UserCard)
        .filter(UserCard.id == body.card_id, UserCard.user_id == current_user.id)
        .first()
    )
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    word = db.query(Word).filter(Word.id == card.word_id).first()
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word missing")

    result = vocab_service.grade(
        db, card, word,
        answer=body.answer,
        response_ms=body.response_ms,
        confidence=body.confidence,
        hints=body.hints,
    )
    return VocabAnswerResponse(**result)
