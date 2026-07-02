import uuid
from typing import Any, Optional

from pydantic import BaseModel


class SaveWordRequest(BaseModel):
    spanish: str
    # Optional sentence the word was tapped in — stored as the card's example.
    context: Optional[str] = None


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


class VocabDetailResponse(BaseModel):
    """Read-only detail for one saved word: identity + full enrichment tips."""
    card_id: uuid.UUID
    word_id: uuid.UUID
    spanish: str
    english: str
    cefr_level: str
    level: int
    tips: dict[str, Any]


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
    # Level 1 self-rating: "know" | "shaky" | "no_idea".
    rating: Optional[str] = None
    # Typed answer for levels 2-5.
    answer: Optional[str] = None


class VocabAnswerResponse(BaseModel):
    correct: bool
    level: int
    mastered: bool
    spanish: str
    # Present only for level-5 Gemini grading: score, correct_usage, feedback, correction.
    feedback: Optional[dict[str, Any]] = None

