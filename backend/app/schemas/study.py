import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel

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

    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    card_id: uuid.UUID
    rating: Literal[1, 2, 3, 4]


class SessionStartResponse(BaseModel):
    id: uuid.UUID
    started_at: datetime

    model_config = {"from_attributes": True}


class SessionEndRequest(BaseModel):
    cards_reviewed: int
    cards_correct: int
