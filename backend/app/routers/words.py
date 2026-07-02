from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.word import Word
from app.schemas.word import WordResponse, WordsPage

router = APIRouter(prefix="/words", tags=["words"])

NEW_CARDS_PER_DAY = 20


@router.get("", response_model=WordsPage)
def list_words(
    category: Optional[str] = Query(default=None),
    cefr_level: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Word)
    if category:
        query = query.filter(Word.category == category)
    if cefr_level:
        query = query.filter(Word.cefr_level == cefr_level)

    total = query.count()
    items = query.offset((page - 1) * size).limit(size).all()
    return WordsPage(
        items=[WordResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        size=size,
    )
