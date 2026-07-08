from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.writing import (
    WritingCoachRequest,
    WritingCoachResponse,
    WritingFeedbackRequest,
    WritingFeedbackResponse,
    WritingRewriteRequest,
    WritingRewriteResponse,
)
from app.services import skill_stats as skill_stats_service
from app.services import writing as writing_service
from app.services.vocab import PASS_SCORE
from app.services.writing import EnrichmentError

router = APIRouter(prefix="/writing", tags=["writing"])


@router.post("/feedback", response_model=WritingFeedbackResponse)
def writing_feedback(
    body: WritingFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Coach a piece of writing (translation / guided / journal) via Gemini."""
    if not body.text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Write something first.")
    try:
        result = writing_service.feedback(body.mode, body.instructions, body.text)
    except EnrichmentError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    skill_stats_service.record_attempt(
        db, current_user.id, skill_stats_service.SKILL_WRITING,
        correct=result["score"] >= PASS_SCORE, score=result["score"],
    )
    return WritingFeedbackResponse(**result)


@router.post("/rewrite", response_model=WritingRewriteResponse)
def writing_rewrite(
    body: WritingRewriteRequest,
    current_user: User = Depends(get_current_user),
):
    """Rewrite the learner's text in a chosen style via Gemini."""
    if not body.text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Write something first.")
    try:
        result = writing_service.rewrite(body.text, body.style)
    except EnrichmentError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return WritingRewriteResponse(**result)


@router.post("/coach", response_model=WritingCoachResponse)
def writing_coach(
    body: WritingCoachRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rich corrective feedback (natural / why / think) for one short answer."""
    if not body.answer.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Write an answer first.")
    try:
        result = writing_service.coach(body.prompt_en, body.target_es, body.answer)
    except EnrichmentError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    skill_stats_service.record_attempt(
        db, current_user.id, skill_stats_service.SKILL_WRITING, correct=result["correct"],
    )
    return WritingCoachResponse(**result)
