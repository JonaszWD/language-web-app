import uuid
from typing import Optional

from pydantic import BaseModel


class WordResponse(BaseModel):
    id: uuid.UUID
    spanish: str
    english: str
    example_sentence: Optional[str]
    category: str
    cefr_level: str
    audio_url: Optional[str]

    model_config = {"from_attributes": True}


class WordsPage(BaseModel):
    items: list[WordResponse]
    total: int
    page: int
    size: int
