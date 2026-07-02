from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.grammar import GrammarCheckRequest, GrammarCheckResponse
from app.services import grammar as grammar_service
from app.services.grammar import EnrichmentError

router = APIRouter(prefix="/grammar", tags=["grammar"])


@router.post("/check", response_model=GrammarCheckResponse)
def check_production(
    body: GrammarCheckRequest,
    current_user: User = Depends(get_current_user),
):
    """Grade the Grammar flow's 'Produce' step via Gemini."""
    if not body.text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Write something first.")
    try:
        result = grammar_service.check_production(body.topic, body.instructions, body.text)
    except EnrichmentError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return GrammarCheckResponse(**result)
