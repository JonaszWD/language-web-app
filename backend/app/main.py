import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import SessionLocal
from app.models.mission import ENRICH_PENDING, ENRICH_PROCESSING, Mission
from app.models.podcast import (
    DOWNLOAD_PENDING,
    TRANSCRIPT_NONE,
    TRANSCRIPT_PENDING,
    PodcastEpisode,
)
from app.routers import auth, grammar, missions, podcasts, stats, study, tts, vocab, words, writing
from app.services.podcast import audio_path, queue_download, start_scheduler, stop_scheduler

logger = logging.getLogger("startup")


def _recover_jobs() -> None:
    """On restart: reset stale pending states and re-queue missing audio downloads."""
    db = SessionLocal()
    try:
        episodes = db.query(PodcastEpisode).all()
        for ep in episodes:
            # Reset transcription jobs that were interrupted mid-run
            if ep.transcript_status == TRANSCRIPT_PENDING:
                ep.transcript_status = TRANSCRIPT_NONE
                ep.transcript_progress = 0

            # Re-queue audio download if the file is missing (covers both stuck-pending and lost-ready)
            if ep.download_status in (DOWNLOAD_PENDING, "ready") and not audio_path(ep.id).exists():
                logger.warning("Audio missing for episode %s — re-queuing download", ep.id)
                ep.download_status = DOWNLOAD_PENDING
                db.commit()
                queue_download(ep.id)

        # Reset missions whose enrichment was interrupted mid-run so the next
        # open can retry (the pipeline is otherwise gated to first open only).
        db.query(Mission).filter(Mission.enrichment_status == ENRICH_PROCESSING).update(
            {Mission.enrichment_status: ENRICH_PENDING}
        )

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _recover_jobs()
    # The 30-minute podcast-refresh job. Disable via ENABLE_SCHEDULER=0
    # (e.g. to avoid duplicate runs across multiple uvicorn workers).
    enabled = os.getenv("ENABLE_SCHEDULER", "1") != "0"
    if enabled:
        start_scheduler()
    try:
        yield
    finally:
        if enabled:
            stop_scheduler()


app = FastAPI(title="Spanish Learning API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(words.router)
app.include_router(study.router)
app.include_router(stats.router)
app.include_router(podcasts.router)
app.include_router(vocab.router)
app.include_router(grammar.router)
app.include_router(writing.router)
app.include_router(missions.router)
app.include_router(tts.router)


@app.get("/health")
def health():
    return {"status": "ok"}
