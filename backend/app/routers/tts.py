"""Text-to-speech endpoints for the listening step.

GET  /tts/speak?text=Hola  → audio/wav synthesised by Gemini (see services.tts),
                             served from the on-disk cache when present.
POST /tts/prewarm          → generate + cache a batch of phrases in the
                             background, so a mission's listening audio is ready
                             before the learner reaches the listening step.
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.services import tts as tts_service

router = APIRouter(prefix="/tts", tags=["tts"])


class PrewarmRequest(BaseModel):
    texts: list[str] = Field(..., max_length=200)


class PrewarmResponse(BaseModel):
    queued: int  # phrases not yet cached, now scheduled for generation


@router.get("/speak")
def speak(text: str = Query(..., min_length=1, max_length=500)):
    """Synthesise Spanish audio for `text` and return it as WAV."""
    try:
        wav = tts_service.synthesize(text)
    except tts_service.TTSError as exc:
        # 502: upstream (Gemini) problem. The frontend falls back to the browser
        # voice when this fails.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Response(
        content=wav,
        media_type="audio/wav",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/prewarm", response_model=PrewarmResponse)
def prewarm(req: PrewarmRequest, background: BackgroundTasks):
    """Generate + cache any not-yet-cached phrases in the background. Returns
    immediately with the number of phrases scheduled; generation continues after
    the response. Idempotent — already-cached phrases are skipped."""
    pending = [t for t in req.texts if not tts_service.is_cached(t)]
    if pending:
        background.add_task(tts_service.prewarm, pending)
    return PrewarmResponse(queued=len(pending))
