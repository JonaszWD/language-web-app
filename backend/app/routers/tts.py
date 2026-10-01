"""Text-to-speech endpoints for the listening step.

GET  /tts/speak?text=Hola&cefr_level=B1
                            → audio synthesised by the provider for that CEFR
                              level (services.tts.provider_for_level — B1
                              routes to ElevenLabs via the LiteLLM proxy,
                              everything else uses the default
                              settings.tts_provider, pyttsx3), served from the
                              on-disk cache when present. cefr_level is
                              optional; omitting it uses the default provider.
POST /tts/prewarm          → generate + cache a batch of phrases (for one
                             cefr_level) in the background, so a mission's
                             listening audio is ready before the learner
                             reaches the listening step.
"""
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.services import tts as tts_service

router = APIRouter(prefix="/tts", tags=["tts"])

_MEDIA_TYPE = {"wav": "audio/wav", "mp3": "audio/mpeg"}


class PrewarmRequest(BaseModel):
    texts: list[str] = Field(..., max_length=200)
    cefr_level: str | None = None


class PrewarmResponse(BaseModel):
    queued: int  # phrases not yet cached, now scheduled for generation


@router.get("/speak")
def speak(
    text: str = Query(..., min_length=1, max_length=500),
    cefr_level: str | None = Query(None),
):
    """Synthesise Spanish audio for `text` and return it in the resolved provider's format."""
    provider = tts_service.provider_for_level(cefr_level)
    try:
        audio = tts_service.synthesize(text, provider)
    except tts_service.TTSError as exc:
        # 502: upstream (pyttsx3/ElevenLabs) problem. The frontend falls back
        # to the browser voice when this fails.
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Response(
        content=audio,
        media_type=_MEDIA_TYPE[tts_service.audio_format(provider)],
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/prewarm", response_model=PrewarmResponse)
def prewarm(req: PrewarmRequest, background: BackgroundTasks):
    """Generate + cache any not-yet-cached phrases in the background. Returns
    immediately with the number of phrases scheduled; generation continues after
    the response. Idempotent — already-cached phrases are skipped."""
    provider = tts_service.provider_for_level(req.cefr_level)
    pending = [t for t in req.texts if not tts_service.is_cached(t, provider)]
    if pending:
        background.add_task(tts_service.prewarm, pending, provider)
    return PrewarmResponse(queued=len(pending))
