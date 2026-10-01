import uuid
from typing import Optional

from pydantic import BaseModel


class ListeningSentence(BaseModel):
    sentence_id: int
    speaker: str
    text_es: str
    text_en: str


class CheckpointResponse(BaseModel):
    id: uuid.UUID
    after_sentence_id: int
    type: str
    prompt: str
    options: Optional[list[str]] = None
    correct_answer: str
    linked_concept_type: Optional[str] = None
    linked_concept_id: Optional[str] = None
    difficulty_tag: Optional[str] = None

    model_config = {"from_attributes": True}


class ListeningItemSummary(BaseModel):
    id: str
    scenario_tag: Optional[str] = None
    cefr_level: str
    title: str
    long_form: bool = False

    model_config = {"from_attributes": True}


class ListeningItemResponse(ListeningItemSummary):
    sentences: list[ListeningSentence]
    vocab_reused: list[str]
    checkpoints: list[CheckpointResponse]


class CheckpointResultRequest(BaseModel):
    checkpoint_id: uuid.UUID
    answer: str
    correct: bool


class CheckpointResultResponse(BaseModel):
    correct: bool
    pushed_to_review: bool


class ListeningCompleteRequest(BaseModel):
    comprehension_score: float
    checkpoints_correct: int
    checkpoints_total: int
    replays_used: int = 0
    transcript_reveals: int = 0
    speed_reached: Optional[float] = None
