from typing import Any

from pydantic import BaseModel


class WritingFeedbackRequest(BaseModel):
    mode: str          # "translation" | "guided" | "journal"
    instructions: str
    text: str


class WritingFeedbackResponse(BaseModel):
    score: int
    feedback: str
    corrections: list[dict[str, Any]]
    natural: list[dict[str, Any]]
    vocab_upgrades: list[dict[str, Any]]


class WritingRewriteRequest(BaseModel):
    text: str
    style: str         # natural | formal | shorter | mexican | spain


class WritingRewriteResponse(BaseModel):
    rewritten: str
    note: str


class WritingCoachRequest(BaseModel):
    prompt_en: str    # the meaning the learner should express
    target_es: str    # a correct Spanish answer
    answer: str       # what the learner wrote


class WritingCoachResponse(BaseModel):
    correct: bool
    natural: str
    why: str
    think: str
