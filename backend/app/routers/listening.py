from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.listening_item import ListeningCheckpoint
from app.models.user import User
from app.schemas.listening import (
    CheckpointResultRequest,
    CheckpointResultResponse,
    ListeningCompleteRequest,
    ListeningItemResponse,
    ListeningItemSummary,
)
from app.services import listening as listening_service
from app.services import story_audio

router = APIRouter(prefix="/listening", tags=["listening"])


@router.get("/items", response_model=list[ListeningItemSummary])
def list_items(
    scenario_tag: str | None = Query(default=None),
    cefr_level: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return listening_service.list_items(db, scenario_tag=scenario_tag, cefr_level=cefr_level)


@router.get("/items/{item_id}", response_model=ListeningItemResponse)
def get_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = listening_service.get_item(db, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listening item not found")
    return item


@router.get("/items/{item_id}/audio")
def get_item_audio(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Single continuous two-voice audio file for a long-form story (see
    services.story_audio). Generated on first request and cached to disk from
    then on — the first request for a story that isn't cached yet is slow
    (real ElevenLabs synthesis of the whole story)."""
    item = listening_service.get_item(db, item_id)
    if item is None or not item.long_form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Long-form story not found")
    try:
        audio = story_audio.get_or_generate(item.id, item.sentences)
    except story_audio.StoryAudioError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Response(content=audio, media_type="audio/mpeg", headers={"Cache-Control": "public, max-age=86400"})


@router.post("/items/{item_id}/audio/prewarm", status_code=status.HTTP_202_ACCEPTED)
def prewarm_item_audio(
    item_id: str,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kick off background generation of a long-form story's audio ahead of
    time, so opening the story doesn't block on it. Idempotent — a no-op once
    cached."""
    item = listening_service.get_item(db, item_id)
    if item is None or not item.long_form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Long-form story not found")
    if not story_audio.is_cached(item_id):
        background.add_task(story_audio.generate, item.id, item.sentences)
    return None


@router.post("/items/{item_id}/checkpoint-result", response_model=CheckpointResultResponse)
def checkpoint_result(
    item_id: str,
    body: CheckpointResultRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    checkpoint = (
        db.query(ListeningCheckpoint)
        .filter(ListeningCheckpoint.id == body.checkpoint_id, ListeningCheckpoint.item_id == item_id)
        .first()
    )
    if checkpoint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checkpoint not found")
    result = listening_service.record_checkpoint_result(db, current_user.id, checkpoint, correct=body.correct)
    return CheckpointResultResponse(**result)


@router.post("/items/{item_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
def complete_item(
    item_id: str,
    body: ListeningCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if listening_service.get_item(db, item_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Listening item not found")
    listening_service.complete_item(
        db, current_user.id, item_id,
        comprehension_score=body.comprehension_score,
        checkpoints_correct=body.checkpoints_correct,
        checkpoints_total=body.checkpoints_total,
        replays_used=body.replays_used,
        transcript_reveals=body.transcript_reveals,
        speed_reached=body.speed_reached,
    )
