import random
import uuid
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.grammar_pattern import GrammarPattern, UserGrammarCard
from app.models.mission import Mission, MissionVocab
from app.models.study_session import StudySession
from app.models.user import User
from app.models.user_card import UserCard
from app.models.word import Word
from app.schemas.study import (
    GrammarCardResponse,
    GrammarReviewRequest,
    GrammarReviewResponse,
    LessonProgressRequest,
    ListeningResultRequest,
    ReviewRequest,
    SessionEndRequest,
    SessionStartResponse,
    UserCardResponse,
    WeakReviewItem,
    WeakReviewResponse,
)
from app.schemas.vocab import CardStats
from app.services import grammar_pattern as grammar_pattern_service
from app.services import skill_stats as skill_stats_service
from app.services import srs as srs_service
from app.services import vocab as vocab_service

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

    # Origin-mission lookup for the tag shown on the card ("From: Coffee Shop"),
    # matched by lowercased spanish — same key add_mission_vocab_to_deck uses.
    # A word from several missions picks the lowest order_index (first taught).
    mission_titles = dict(
        db.query(func.lower(MissionVocab.spanish), Mission.title)
        .join(Mission, Mission.id == MissionVocab.mission_id)
        .order_by(Mission.order_index.desc())
        .all()
    )

    # Enrich with word data
    def enrich(card: UserCard) -> UserCardResponse:
        word = db.query(Word).filter(Word.id == card.word_id).first()
        resp = UserCardResponse.model_validate(card)
        if word:
            from app.schemas.word import WordResponse
            resp.word = WordResponse.model_validate(word)
            resp.mission_title = mission_titles.get(word.spanish.strip().lower())
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
            resp.mission_title = mission_titles.get(word.spanish.strip().lower())
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

    # Record per-user performance. In FSRS review a rating of Good/Easy (3-4) is a
    # successful recall; confidence is derived from the rating when the client
    # doesn't send its own (1→0, 2→33, 3→67, 4→100).
    now = datetime.now(timezone.utc)
    correct = body.rating >= 3
    confidence = body.confidence if body.confidence is not None else (body.rating - 1) / 3 * 100
    vocab_service.record_attempt(
        card,
        correct=correct,
        now=now,
        response_ms=body.response_ms,
        confidence=confidence,
        hints=body.hints,
    )
    db.commit()
    db.refresh(card)

    word = db.query(Word).filter(Word.id == card.word_id).first()
    resp = UserCardResponse.model_validate(card)
    resp.stats = CardStats(**vocab_service.card_stats(card, now=now))
    if word:
        from app.schemas.word import WordResponse
        resp.word = WordResponse.model_validate(word)
    return resp


@router.get("/due-grammar", response_model=list[GrammarCardResponse])
def get_due_grammar_cards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Due grammar-pattern cloze reviews — the counterpart of /study/due for
    patterns instead of words. Only includes patterns the learner has already
    encountered at least once in a GrammarLesson (a UserGrammarCard is created
    lazily on first review, not proactively seeded), same as how a word only
    becomes reviewable once it's actually been trained."""
    today = date.today()
    rows = (
        db.query(UserGrammarCard, GrammarPattern, Mission.title)
        .join(GrammarPattern, GrammarPattern.id == UserGrammarCard.pattern_id)
        .join(Mission, Mission.id == GrammarPattern.mission_id)
        .filter(UserGrammarCard.user_id == current_user.id, UserGrammarCard.due_date <= today)
        .all()
    )
    return [
        GrammarCardResponse(
            id=card.id,
            pattern_id=pattern.id,
            pattern=pattern.pattern,
            gloss=pattern.gloss,
            cloze_template=pattern.cloze_template,
            due_date=card.due_date,
            mission_title=mission_title,
        )
        for card, pattern, mission_title in rows
    ]


@router.post("/review-grammar", response_model=GrammarReviewResponse)
def review_grammar_card(
    body: GrammarReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grade one grammar-pattern cloze answer and reschedule it via FSRS.
    Creates the learner's UserGrammarCard on first encounter."""
    pattern = db.query(GrammarPattern).filter(GrammarPattern.id == body.pattern_id).first()
    if pattern is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pattern not found")
    result = grammar_pattern_service.grade_pattern(db, current_user.id, pattern, body.answer)
    skill_stats_service.record_attempt(
        db, current_user.id, skill_stats_service.SKILL_GRAMMAR,
        correct=result["correct"], response_ms=body.response_ms,
    )
    return GrammarReviewResponse(**result)


@router.post("/listening-result", status_code=status.HTTP_204_NO_CONTENT)
def listening_result(
    body: ListeningResultRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log one listening-comprehension outcome from ListeningLesson. Listening
    isn't FSRS-scheduled content — this is a rollup counter only, no card."""
    skill_stats_service.record_attempt(
        db, current_user.id, skill_stats_service.SKILL_LISTENING, correct=body.correct,
    )


@router.get("/weak-review", response_model=WeakReviewResponse)
def get_weak_review(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The Review lesson's question set — this user's actual worst-performing
    words and shakiest grammar pattern, not a fixed daily mix. Each weak word
    is asked back across the 4 vocab-facing exercise shapes the Review UI
    supports (Vocabulary/Translate/Listening/Speaking all quiz the same word,
    just different retrieval angles) so the same weak spot gets hit from
    multiple directions in one session; grading flows through the exact same
    POST /study/review and /study/review-grammar endpoints the dedicated
    trainers use, so a Review-lesson answer counts for FSRS scheduling and the
    skill-stats rollup exactly like any other."""
    weak_cards = vocab_service.weakest_words(db, current_user.id, limit=6)
    weak_patterns = grammar_pattern_service.weakest_patterns(db, current_user.id, limit=3)

    items: list[WeakReviewItem] = []
    vocab_skills: list[Literal["Vocabulary", "Translate", "Listening", "Speaking"]] = [
        "Vocabulary", "Translate", "Listening", "Speaking",
    ]
    for i, card in enumerate(weak_cards):
        word = db.query(Word).filter(Word.id == card.word_id).first()
        if not word:
            continue
        items.append(WeakReviewItem(
            skill=vocab_skills[i % len(vocab_skills)],
            es=word.spanish, en=word.english, card_id=card.id,
        ))
    for pattern in weak_patterns:
        items.append(WeakReviewItem(
            skill="Grammar", es=pattern.cloze_answer, en=pattern.gloss,
            pattern_id=pattern.id, cloze_template=pattern.cloze_template,
        ))

    random.shuffle(items)
    weakest_skill = skill_stats_service.weakest_skill(db, current_user.id)
    return WeakReviewResponse(items=items, weakest_skill=weakest_skill)


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
        user.longest_streak = max(user.longest_streak, user.streak_count)

    db.commit()
    db.refresh(session)
    skill_stats_service.bust_dashboard_cache(current_user.id)
    return session


@router.post("/lesson-progress", status_code=status.HTTP_204_NO_CONTENT)
def lesson_progress(
    body: LessonProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Engagement ping from a scripted lesson deck — see LessonProgressRequest.
    Never raises past auth; a failed/slow ping should never break the lesson
    the learner is actually doing."""
    skill_stats_service.record_lesson_progress(
        db, current_user.id, body.skill,
        stage=body.stage, replay=body.replay,
        transcript_reveal=body.transcript_reveal, speed=body.speed,
    )
