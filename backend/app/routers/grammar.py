from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.grammar import GrammarCheckRequest, GrammarCheckResponse
from app.services import grammar as grammar_service
from app.services import skill_stats as skill_stats_service
from app.services.grammar import EnrichmentError

router = APIRouter(prefix="/grammar", tags=["grammar"])


@router.post("/check", response_model=GrammarCheckResponse)
def check_production(
    body: GrammarCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Grade the Grammar flow's 'Produce' step via Gemini."""
    if not body.text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Write something first.")
    try:
        result = grammar_service.check_production(body.topic, body.instructions, body.text)
    except EnrichmentError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    # Free production graded by Gemini — same skill dimension as the writing
    # coach/feedback endpoints, not a separate "grammar" score.
    skill_stats_service.record_attempt(
        db, current_user.id, skill_stats_service.SKILL_WRITING,
        correct=result["meets_requirement"], score=result["score"],
    )
    return GrammarCheckResponse(**result)
