import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.study_session import StudySession
from app.models.user import User
from app.models.user_card import UserCard
from app.models.word import Word
from app.schemas.study import (
    ReviewRequest,
    SessionEndRequest,
    SessionStartResponse,
    UserCardResponse,
)
from app.services import srs as srs_service

router = APIRouter(prefix="/study", tags=["study"])

NEW_CARDS_PER_DAY = 20


@router.get("/due", response_model=list[UserCardResponse])
def get_due_cards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    # Existing cards due today (review / learning / relearning)
    due_cards = (
        db.query(UserCard)
        .filter(
            UserCard.user_id == current_user.id,
            UserCard.due_date <= today,
            UserCard.state != "new",
        )
        .all()
    )

    # Enrich with word data
    def enrich(card: UserCard) -> UserCardResponse:
        word = db.query(Word).filter(Word.id == card.word_id).first()
        resp = UserCardResponse.model_validate(card)
        if word:
            from app.schemas.word import WordResponse
            resp.word = WordResponse.model_validate(word)
        return resp

    result = [enrich(c) for c in due_cards]

    # Add new cards up to daily limit if under cap
    if len(result) < NEW_CARDS_PER_DAY:
        already_seen_word_ids = {c.word_id for c in db.query(UserCard).filter(UserCard.user_id == current_user.id).all()}
        new_words = (
            db.query(Word)
            .filter(Word.id.notin_(already_seen_word_ids))
            .limit(NEW_CARDS_PER_DAY - len(result))
            .all()
        )
        for word in new_words:
            card = UserCard(
                user_id=current_user.id,
                word_id=word.id,
                due_date=today,
                state="new",
            )
            db.add(card)
            db.flush()
            resp = UserCardResponse(
                id=card.id,
                user_id=card.user_id,
                word_id=card.word_id,
                due_date=card.due_date,
                stability=card.stability,
                difficulty=card.difficulty,
                reps=card.reps,
                lapses=card.lapses,
                state=card.state,
            )
            from app.schemas.word import WordResponse
            resp.word = WordResponse.model_validate(word)
            result.append(resp)

        db.commit()

    return result


@router.post("/review", response_model=UserCardResponse)
def review_card(
    body: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    card = db.query(UserCard).filter(
        UserCard.id == body.card_id,
        UserCard.user_id == current_user.id,
    ).first()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    today = date.today()
    update = srs_service.schedule(
        stability=card.stability,
        difficulty=card.difficulty,
        reps=card.reps,
        lapses=card.lapses,
        state=card.state,
        rating=body.rating,
        now=today,
    )

    card.stability = update.stability
    card.difficulty = update.difficulty
    card.reps = update.reps
    card.lapses = update.lapses
    card.state = update.state
    card.due_date = update.due_date
    db.commit()
    db.refresh(card)

    word = db.query(Word).filter(Word.id == card.word_id).first()
    resp = UserCardResponse.model_validate(card)
    if word:
        from app.schemas.word import WordResponse
        resp.word = WordResponse.model_validate(word)
    return resp


@router.post("/session", response_model=SessionStartResponse, status_code=status.HTTP_201_CREATED)
def start_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = StudySession(user_id=current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.patch("/session/{session_id}", response_model=SessionStartResponse)
def end_session(
    session_id: uuid.UUID,
    body: SessionEndRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(StudySession).filter(
        StudySession.id == session_id,
        StudySession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    session.ended_at = datetime.now(timezone.utc)
    session.cards_reviewed = body.cards_reviewed
    session.cards_correct = body.cards_correct

    # Update user streak
    today = date.today()
    user = db.query(User).filter(User.id == current_user.id).first()
    if user:
        if user.last_study_date is None:
            user.streak_count = 1
        elif (today - user.last_study_date).days == 1:
            user.streak_count += 1
        elif (today - user.last_study_date).days > 1:
            user.streak_count = 1
        user.last_study_date = today

    db.commit()
    db.refresh(session)
    return session
