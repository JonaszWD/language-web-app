import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
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


def _tips(word: Word) -> dict:
    enr = word.enrichment or {}
    return {k: enr[k] for k in _TIP_KEYS if k in enr}


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
    )


@router.get("/next", response_model=VocabCardResponse | None)
def next_vocab_card(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The next vocabulary-training item: oldest-due card still in training,
    lowest level first. Returns null when nothing is due."""
    card = (
        db.query(UserCard)
        .filter(
            UserCard.user_id == current_user.id,
            UserCard.due_date <= date.today(),
        )
        .order_by(UserCard.level.asc(), UserCard.due_date.asc())
        .first()
    )
    if card is None:
        return None

    word = db.query(Word).filter(Word.id == card.word_id).first()
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word missing")

    vocab_service.ensure_enrichment(db, word)
    return VocabCardResponse(
        card_id=card.id,
        word_id=word.id,
        level=card.level,
        exercise=vocab_service.build_exercise(word, card.level),
        tips=_tips(word),
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

    result = vocab_service.grade(db, card, word, answer=body.answer, rating=body.rating)
    return VocabAnswerResponse(**result)
