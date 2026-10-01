import uuid
from typing import Any, Optional

from pydantic import BaseModel


class SaveWordRequest(BaseModel):
    spanish: str
    # Optional sentence the word was tapped in — stored as the card's example.
    context: Optional[str] = None


class TranslateResponse(BaseModel):
    """Read-only Spanish→English lookup — does not touch the user's deck."""
    spanish: str
    english: str


class SavedWordResponse(BaseModel):
    word_id: uuid.UUID
    spanish: str
    english: str
    # True when this tap created a new study card; False when it was already saved.
    added: bool


class VocabListItem(BaseModel):
    """One saved word in the collection grid: identity + training level."""
    card_id: uuid.UUID
    word_id: uuid.UUID
    spanish: str
    english: str
    cefr_level: str
    level: int          # 1-5 training level
    due: bool           # due for training today


class CardStats(BaseModel):
    """Per-user performance for one word. Ratios are derived from raw counters;
    None where there are no attempts yet."""
    attempts: int
    accuracy: Optional[float] = None                    # correct / attempts, 0-1
    avg_response_ms: Optional[float] = None             # mean answer time (ms)
    avg_confidence: Optional[float] = None              # mean self-reported confidence, 0-100
    hints: int                                          # total hints revealed
    seconds_since_last_success: Optional[float] = None  # None if never answered correctly


class VocabDetailResponse(BaseModel):
    """Read-only detail for one saved word: identity + full enrichment tips."""
    card_id: uuid.UUID
    word_id: uuid.UUID
    spanish: str
    english: str
    cefr_level: str
    level: int
    tips: dict[str, Any]
    stats: CardStats


class VocabCardResponse(BaseModel):
    """One vocabulary-training item: the card, its level, the exercise payload,
    and the 'chunks not isolated words' tips surfaced on every screen."""
    card_id: uuid.UUID
    word_id: uuid.UUID
    level: int
    exercise: dict[str, Any]
    # Trimmed enrichment for the tip strip (chunks, collocations, gender...).
    tips: dict[str, Any]


class VocabAnswerRequest(BaseModel):
    card_id: uuid.UUID
    # The submitted answer: level-1 is the picked MCQ option text, levels 2-5
    # are typed Spanish.
    answer: Optional[str] = None
    # Per-attempt telemetry (all optional). Time from prompt shown to answer (ms),
    # self-reported confidence 0-100, and hints revealed on this attempt.
    response_ms: Optional[int] = None
    confidence: Optional[float] = None
    hints: Optional[int] = None


class VocabAnswerResponse(BaseModel):
    correct: bool
    level: int
    mastered: bool
    spanish: str
    # Present only for level-5 Mistral grading: score, correct_usage, feedback, correction.
    feedback: Optional[dict[str, Any]] = None
    # Updated per-user performance for this word after recording the attempt.
    stats: Optional[CardStats] = None

