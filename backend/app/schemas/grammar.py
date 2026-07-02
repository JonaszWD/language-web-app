from typing import Any

from pydantic import BaseModel


class GrammarCheckRequest(BaseModel):
    topic: str
    instructions: str
    text: str


class GrammarCheckResponse(BaseModel):
    score: int
    meets_requirement: bool
    feedback: str
    verbs_used: list[str]
    corrections: list[dict[str, Any]]
