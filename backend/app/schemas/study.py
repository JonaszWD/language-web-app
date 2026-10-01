import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel

from app.schemas.vocab import CardStats
from app.schemas.word import WordResponse


class UserCardResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    word_id: uuid.UUID
    due_date: date
    stability: float
    difficulty: float
    reps: int
    lapses: int
    state: str
    word: Optional[WordResponse] = None
    # Per-user performance for this word (accuracy/response time/confidence/...).
    stats: Optional[CardStats] = None
    # The mission this word came from, if any (matched by lowercased spanish).
    # None for words saved from a podcast tap or the Vocabulary tab directly.
    mission_title: Optional[str] = None

    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    card_id: uuid.UUID
    rating: Literal[1, 2, 3, 4]
    # Per-attempt telemetry (all optional): answer time (ms), self-reported
    # confidence 0-100, and hints revealed on this review.
    response_ms: Optional[int] = None
    confidence: Optional[float] = None
    hints: Optional[int] = None


class SessionStartResponse(BaseModel):
    id: uuid.UUID
    started_at: datetime

    model_config = {"from_attributes": True}


class SessionEndRequest(BaseModel):
    cards_reviewed: int
    cards_correct: int


class GrammarCardResponse(BaseModel):
    """One due grammar-pattern cloze — the review-tab counterpart of
    UserCardResponse, for patterns instead of words."""

    id: uuid.UUID           # UserGrammarCard id
    pattern_id: uuid.UUID
    pattern: str
    gloss: str
    cloze_template: str
    due_date: date
    mission_title: Optional[str] = None


class GrammarReviewRequest(BaseModel):
    pattern_id: uuid.UUID
    answer: str
    response_ms: Optional[int] = None


class GrammarReviewResponse(BaseModel):
    correct: bool
    cloze_answer: str
    due_date: date


class ListeningResultRequest(BaseModel):
    correct: bool


class LessonProgressRequest(BaseModel):
    """Fire-and-forget engagement ping from a scripted lesson (the 7-stage
    Grammar/Listening/Writing decks) — how far the learner got and how much
    support they needed, none of which fits record_attempt's right/wrong
    shape. All fields optional; a call only reports what changed."""

    skill: Literal["grammar", "listening", "writing"]
    stage: Optional[int] = None
    replay: bool = False
    transcript_reveal: bool = False
    speed: Optional[float] = None


class WeakReviewItem(BaseModel):
    """One question in the weakness-targeted Review lesson. Vocab-sourced
    items (Vocabulary/Translate/Listening/Speaking) carry card_id so the
    client grades them through the normal POST /study/review; the one
    Grammar-sourced item carries pattern_id + cloze_template for
    POST /study/review-grammar instead — same grading/FSRS machinery either
    way, just fed from each user's weakest cards/patterns instead of a fixed
    due-date queue."""

    skill: Literal["Translate", "Listening", "Grammar", "Speaking", "Vocabulary"]
    es: str
    en: str
    card_id: Optional[uuid.UUID] = None
    pattern_id: Optional[uuid.UUID] = None
    cloze_template: Optional[str] = None


class WeakReviewResponse(BaseModel):
    items: list[WeakReviewItem]
    # The single lowest-accuracy skill category (dashboard rollup), surfaced
    # so the lesson intro can say what it's targeting. None for a learner too
    # new to have a qualifying skill yet.
    weakest_skill: Optional[str] = None
