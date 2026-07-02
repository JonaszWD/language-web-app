import uuid
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.podcast import (
    DOWNLOAD_PENDING,
    NO_TRANSCRIPT,
    TRANSCRIPT_PENDING,
    TRANSCRIPT_READY,
    PodcastEpisode,
)
from app.models.user import User
from app.schemas.podcast import (
    AddFeedRequest,
    EpisodeResponse,
    FeedResponse,
    PodcastSettings,
)
from app.services import podcast as podcast_service

router = APIRouter(prefix="/podcasts", tags=["podcasts"])


@router.get("/settings", response_model=PodcastSettings)
def get_settings(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return PodcastSettings(auto_transcribe=podcast_service.get_auto_transcribe(db))


@router.put("/settings", response_model=PodcastSettings)
def update_settings(
    body: PodcastSettings,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    enabled = podcast_service.set_auto_transcribe(db, body.auto_transcribe)
    return PodcastSettings(auto_transcribe=enabled)


def _playlist_id(url: str) -> str | None:
    try:
        values = parse_qs(urlparse(url).query).get("list")
    except ValueError:
        return None
    return values[0] if values and values[0] else None


@router.get("/feeds", response_model=list[FeedResponse])
def get_feeds(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    return podcast_service.get_all_feeds(db)


@router.post("/feed", response_model=FeedResponse)
def add_feed(
    body: AddFeedRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Add a YouTube playlist as a podcast feed."""
    url = body.feed_url.strip()
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid YouTube playlist URL.",
        )
    host = urlparse(url).netloc.lower()
    if "youtube.com" not in host and "youtu.be" not in host:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only YouTube playlist URLs are supported.",
        )
    if not _playlist_id(url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Paste a YouTube playlist URL (it contains "list=").',
        )
    try:
        return podcast_service.add_feed(db, url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/feed/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feed(
    feed_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    podcast_service.remove_feed(db, feed_id)


@router.post("/refresh", response_model=list[FeedResponse])
def refresh_feeds(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Check all feeds for new videos and queue downloads for any found."""
    return podcast_service.refresh_all_feeds(db)


def _stream_file_range(path, start: int, end: int, chunk_size: int = 64 * 1024):
    """Yield bytes [start, end] inclusive from a file, for HTTP 206 responses."""
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(chunk_size, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


@router.get("/audio/{episode_id}")
def get_audio(
    episode_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    ep = db.get(PodcastEpisode, episode_id)
    if ep is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episode not found.")
    path = podcast_service.audio_path(episode_id)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio not yet available.")

    # Serve with HTTP Range support so the browser can seek/skip. Without this the
    # audio element treats the stream as non-seekable and snaps back to 0.
    file_size = path.stat().st_size
    range_header = request.headers.get("range")
    if not range_header:
        return FileResponse(
            str(path), media_type="audio/mpeg", headers={"Accept-Ranges": "bytes"}
        )

    start, end = 0, file_size - 1
    try:
        units, _, rng = range_header.partition("=")
        if units.strip().lower() != "bytes":
            raise ValueError
        start_s, _, end_s = rng.strip().partition("-")
        if start_s:
            start = int(start_s)
        if end_s:
            end = int(end_s)
    except ValueError:
        start, end = 0, file_size - 1

    if start > end or start >= file_size:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
        )
    end = min(end, file_size - 1)
    length = end - start + 1
    return StreamingResponse(
        _stream_file_range(path, start, end),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type="audio/mpeg",
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(length),
        },
    )


@router.get("/episodes/{episode_id}", response_model=EpisodeResponse)
def get_episode(
    episode_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    ep = db.get(PodcastEpisode, episode_id)
    if ep is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episode not found.")
    return ep


@router.post("/episodes/{episode_id}/transcribe", response_model=EpisodeResponse)
def transcribe_episode(
    episode_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    ep = db.get(PodcastEpisode, episode_id)
    if ep is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episode not found.")
    if not ep.audio_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio not downloaded yet.",
        )
    if ep.transcript_status == TRANSCRIPT_PENDING:
        return ep
    if ep.transcript_status == TRANSCRIPT_READY and ep.transcript != NO_TRANSCRIPT:
        return ep

    ep.transcript_status = TRANSCRIPT_PENDING
    db.commit()
    db.refresh(ep)
    podcast_service.queue_transcription(ep.id)
    return ep


@router.post("/episodes/{episode_id}/download", response_model=EpisodeResponse)
def redownload_episode(
    episode_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Retry downloading an episode's audio from YouTube (e.g. after a failure)."""
    ep = db.get(PodcastEpisode, episode_id)
    if ep is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Episode not found.")
    if not ep.guid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This episode has no source video to download.",
        )
    if ep.download_status == DOWNLOAD_PENDING:
        return ep  # a download is already in progress

    ep.download_status = DOWNLOAD_PENDING
    db.commit()
    db.refresh(ep)
    podcast_service.queue_download(ep.id)
    return ep
