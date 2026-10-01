"""Free-conversation speaking — talk with the AI, outside any mission.

The Speaking tab lets a learner pick a scenario (or free chat) and hold a live
conversation with an in-character AI. This reuses the same turn engine as the
mission Final Challenge (services.missions.stream_speaking_turn →
enrich.stream_speaking_turn); it just isn't tied to a mission, so there's no
mission vocab to bias toward. Unlike the mission endpoint, this one streams the
NPC's reply token-by-token over SSE and always uses Claude Haiku directly (no
Mistral primary/fallback) so the reply starts appearing immediately.
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.mission import SpeakingTurnRequest
from app.services import missions as missions_service
from app.services import skill_stats as skill_stats_service
from app.services import speech_engine
from app.services import vocab as vocab_service

router = APIRouter(prefix="/speaking", tags=["speaking"])


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


@router.post("/turn")
def speaking_turn(
    body: SpeakingTurnRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Evaluate one learner utterance in a free conversation and stream back the
    NPC's in-character reply as SSE. The client supplies the scene (role /
    setting / goal) and the running history. Emits {"type":"delta","text":...}
    chunks as the reply streams in, then one {"type":"final",...} event shaped
    like the old JSON response, or {"type":"error","detail":...} on failure.
    """
    # Fail fast, before opening the stream, if Claude isn't reachable at all —
    # matches the old endpoint's behaviour of a clean 502 rather than a stream
    # that opens and then immediately errors.
    if not missions_service.enrich_service.settings.claude_api_key:
        raise HTTPException(status_code=502, detail="Claude is not configured. Set CLAUDE_API_KEY in the backend environment.")

    user_id = current_user.id
    confidence = body.confidence
    retry_count = body.retry_count
    recorded = body.recorded

    def generate():
        try:
            gen = missions_service.stream_speaking_turn(
                role=body.role,
                setting=body.setting,
                goal=body.goal,
                history=[(t.speaker, t.text) for t in body.history],
                utterance=body.utterance,
                vocab=[],  # no mission vocab to bias toward in free chat
                objectives=body.objectives or None,
            )
            result = None
            for event in gen:
                if event["type"] == "final":
                    result = event
                else:
                    yield _sse(event)
        except missions_service.enrich_service.EnrichmentError as exc:
            yield _sse({"type": "error", "detail": str(exc)})
            return

        # The injected `db` session is closed once this endpoint function
        # returns (which happens as soon as the StreamingResponse is created,
        # not once this generator finishes) — so side effects here need their
        # own session, same pattern as the background job workers.
        side_db = SessionLocal()
        try:
            if result.get("understood"):
                for spanish in result.get("words_used") or []:
                    vocab_service.apply_word_signal(side_db, user_id, spanish, rating=4)
            skill_stats_service.record_attempt(
                side_db, user_id, skill_stats_service.SKILL_CONVERSATION,
                correct=result.get("understood"), retries=retry_count, recorded=recorded,
            )
            if confidence is not None:
                skill_stats_service.record_attempt(
                    side_db, user_id, skill_stats_service.SKILL_PRONUNCIATION,
                    score=confidence * 100,
                )
        finally:
            side_db.close()
        yield _sse(result)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            # Prevent any intermediary (dev proxy, uvicorn, browser) from
            # buffering the whole response before delivering it — without
            # these the client can see nothing until the stream closes.
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


class SpeakRequest(BaseModel):
    text: str


class PronunciationAttempt(BaseModel):
    score: float = Field(ge=0, le=100)  # % of target words recognised clearly


@router.post("/pronunciation", status_code=204)
def record_pronunciation(
    body: PronunciationAttempt,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log one Pronunciation-practice attempt. Scoring happens in the browser
    (Web Speech API transcript vs. target); this only rolls it into the
    `pronunciation` skill row so the Home dashboard reflects it. An attempt
    counts as correct when at least 80% of the words came through clearly."""
    skill_stats_service.record_attempt(
        db,
        current_user.id,
        skill_stats_service.SKILL_PRONUNCIATION,
        correct=body.score >= 80,
        score=body.score,
        recorded=True,
    )


@router.post("/speak")
def speaking_speak(
    body: SpeakRequest,
    current_user: User = Depends(get_current_user),
):
    """Synthesise the NPC's reply via ElevenLabs text-to-speech, played back
    in the browser. The learner's own speech is captured client-side by the
    browser's Web Speech API — this only covers the NPC's voice."""
    try:
        audio = speech_engine.synthesize(body.text)
    except speech_engine.SpeechEngineError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Response(content=audio, media_type="audio/mpeg")
