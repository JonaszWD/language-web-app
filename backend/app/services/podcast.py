"""YouTube podcast import using yt-dlp.

A single YouTube source (channel, playlist, or video) acts as the active feed.
Metadata is extracted immediately; audio downloads happen in the background.
Transcription (via faster-whisper) runs on demand after an episode is downloaded.
"""
from __future__ import annotations

import logging
import os
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from yt_dlp import YoutubeDL

from app.database import SessionLocal
from app.models.app_setting import AppSetting
from app.models.podcast import (
    DOWNLOAD_FAILED,
    DOWNLOAD_NONE,
    DOWNLOAD_PENDING,
    DOWNLOAD_READY,
    NO_TRANSCRIPT,
    TRANSCRIPT_FAILED,
    TRANSCRIPT_NONE,
    TRANSCRIPT_PENDING,
    TRANSCRIPT_READY,
    PodcastEpisode,
    PodcastFeed,
)

logger = logging.getLogger("podcast")

# Key in the app_settings table for the "auto-transcribe new downloads" toggle.
AUTO_TRANSCRIBE_KEY = "auto_transcribe"


def get_auto_transcribe(db: Session) -> bool:
    row = db.get(AppSetting, AUTO_TRANSCRIBE_KEY)
    return row is not None and row.value == "true"


def set_auto_transcribe(db: Session, enabled: bool) -> bool:
    row = db.get(AppSetting, AUTO_TRANSCRIBE_KEY)
    if row is None:
        row = AppSetting(key=AUTO_TRANSCRIBE_KEY, value="true" if enabled else "false")
        db.add(row)
    else:
        row.value = "true" if enabled else "false"
    db.commit()
    return enabled

MAX_EPISODES = 4        # episodes fetched (and downloaded) per feed on first add
MAX_DOWNLOADS = 4       # kept separate for clarity; equals MAX_EPISODES
MAX_GENERATED_CHARS = 100_000
REFRESH_MINUTES = 30
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
AUDIO_DIR = Path(os.getenv("AUDIO_DIR", "/data/podcasts"))

_YDL_COMMON = {
    "quiet": True,
    "no_warnings": True,
    "noprogress": True,
}


def audio_path(episode_id: uuid.UUID) -> Path:
    return AUDIO_DIR / f"{episode_id}.mp3"


# ── YouTube metadata extraction ─────────────────────────────────────────

def _vid_id_from_url(url: str) -> str | None:
    """Extract an 11-char YouTube video ID from any YouTube URL form."""
    m = re.search(r"(?:v=|youtu\.be/|/v/|/embed/|/shorts/)([a-zA-Z0-9_-]{11})", url)
    return m.group(1) if m else None


def fetch_youtube_info(url: str) -> tuple[dict, list[dict]]:
    """Extract metadata for a YouTube channel, playlist, or video.

    Returns (feed_meta, [episode_meta, ...]).  Raises ValueError on failure.
    Does NOT download any audio — that happens in background jobs.
    """
    opts = {
        **_YDL_COMMON,
        "extract_flat": True,
        "playlistend": MAX_EPISODES,
        # ignoreerrors left off intentionally — we want to surface real failures
    }
    with YoutubeDL(opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
        except Exception as exc:
            raise ValueError(f"Could not load YouTube URL: {exc}") from exc

    if not info:
        raise ValueError("Nothing found at that YouTube URL.")

    raw_entries = info.get("entries")
    if raw_entries is not None:
        # entries may be a lazy iterator — materialize it fully
        entries: list[dict] = []
        for e in raw_entries:
            if not e:
                continue
            # `id` is usually the video ID; fall back to parsing it from `url`
            vid_id = e.get("id") or _vid_id_from_url(e.get("url") or e.get("webpage_url") or "")
            if not vid_id:
                continue
            entries.append({**e, "id": vid_id})

        if not entries:
            raise ValueError(
                "No videos found in this playlist. "
                "Make sure it is public and contains videos."
            )

        feed_meta = {
            "title": (
                info.get("title")
                or info.get("channel")
                or info.get("uploader")
                or "YouTube playlist"
            )[:500],
            "author": info.get("uploader") or info.get("channel"),
            "image_url": _best_thumbnail(info.get("thumbnails") or []),
        }
        episodes = [_entry_to_ep(e, idx) for idx, e in enumerate(entries[:MAX_EPISODES])]
    else:
        # Single video
        vid_id = info.get("id") or _vid_id_from_url(url)
        if not vid_id:
            raise ValueError("Could not extract video ID.")
        channel = info.get("channel") or info.get("uploader") or "YouTube"
        feed_meta = {
            "title": channel[:500],
            "author": channel,
            "image_url": _best_thumbnail(info.get("thumbnails") or []),
        }
        episodes = [_entry_to_ep(info, 0)]

    if not episodes:
        raise ValueError("No videos found at that URL.")

    return feed_meta, episodes


def _best_thumbnail(thumbnails: list[dict]) -> str | None:
    valid = [t for t in thumbnails if t.get("url")]
    if not valid:
        return None
    return max(valid, key=lambda t: t.get("width", 0) * t.get("height", 0)).get("url")


def _entry_to_ep(entry: dict, idx: int) -> dict:
    vid_id = entry.get("id", "")
    return {
        "guid": vid_id,
        "title": (entry.get("title") or "Untitled")[:1000],
        "audio_url": None,
        "image_url": f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg" if vid_id else None,
        "duration": _fmt_duration(entry.get("duration")),
        "published_at": _parse_date(entry.get("upload_date")),
        "transcript": NO_TRANSCRIPT,
        "transcript_url": None,
        "transcript_status": TRANSCRIPT_NONE,
        "download_status": DOWNLOAD_NONE,
        "position": idx,
    }


def _fmt_duration(secs: int | float | None) -> str | None:
    if secs is None:
        return None
    s = int(secs)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y%m%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# ── Persistence ──────────────────────────────────────────────────────────

def get_all_feeds(db: Session) -> list[PodcastFeed]:
    return db.query(PodcastFeed).order_by(PodcastFeed.created_at).all()


def add_feed(db: Session, url: str) -> PodcastFeed:
    """Add a YouTube playlist as a new feed; skip if the URL is already saved."""
    existing = db.query(PodcastFeed).filter(PodcastFeed.feed_url == url[:1000]).first()
    if existing:
        db.refresh(existing)
        return existing

    meta, episodes = fetch_youtube_info(url)

    feed = PodcastFeed(
        feed_url=url[:1000],
        title=meta["title"],
        author=meta["author"],
        image_url=meta["image_url"],
        last_checked_at=datetime.now(timezone.utc),
    )
    db.add(feed)
    db.flush()

    ep_objs: list[PodcastEpisode] = []
    for ep_data in episodes:
        ep = PodcastEpisode(feed_id=feed.id, **ep_data)
        db.add(ep)
        ep_objs.append(ep)

    db.commit()
    db.refresh(feed)

    # Download all MAX_EPISODES episodes (== MAX_DOWNLOADS == 4)
    for ep in ep_objs[:MAX_DOWNLOADS]:
        queue_download(ep.id)

    return feed


def remove_feed(db: Session, feed_id: uuid.UUID) -> None:
    """Delete a feed, its episodes, and their downloaded audio files."""
    feed = db.get(PodcastFeed, feed_id)
    if not feed:
        return
    for ep in feed.episodes:
        p = audio_path(ep.id)
        p.unlink(missing_ok=True)
    db.delete(feed)
    db.commit()


def refresh_all_feeds(db: Session) -> list[PodcastFeed]:
    """Check every feed for new videos and queue downloads for any found."""
    feeds = db.query(PodcastFeed).all()
    for feed in feeds:
        try:
            _, latest = fetch_youtube_info(feed.feed_url)
        except ValueError as exc:
            logger.warning("Feed refresh failed for %s: %s", feed.feed_url, exc)
            feed.last_checked_at = datetime.now(timezone.utc)
            continue

        existing_guids = {ep.guid for ep in feed.episodes if ep.guid}
        new_eps = [ep for ep in latest if ep["guid"] not in existing_guids]

        if new_eps:
            min_pos = min((ep.position for ep in feed.episodes), default=0)
            new_objs: list[PodcastEpisode] = []
            for i, ep_data in enumerate(new_eps):
                ep = PodcastEpisode(
                    feed_id=feed.id,
                    **{**ep_data, "position": min_pos - len(new_eps) + i},
                )
                db.add(ep)
                new_objs.append(ep)
            db.flush()
            for ep in new_objs:
                queue_download(ep.id)

        feed.last_checked_at = datetime.now(timezone.utc)

    db.commit()
    for feed in feeds:
        db.refresh(feed)
    return feeds


# ── Audio download (yt-dlp) ──────────────────────────────────────────────

_download_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="yt-dl")


def _download_yt_audio(video_id: str, out_path: Path) -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    url = f"https://www.youtube.com/watch?v={video_id}"
    opts = {
        **_YDL_COMMON,
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "128",
        }],
        "outtmpl": str(out_path.with_suffix("")),
    }
    with YoutubeDL(opts) as ydl:
        ydl.download([url])


def _download_job(episode_id: uuid.UUID) -> None:
    db = SessionLocal()
    try:
        ep = db.get(PodcastEpisode, episode_id)
        if ep is None or not ep.guid:
            return

        ep.download_status = DOWNLOAD_PENDING
        db.commit()

        try:
            _download_yt_audio(ep.guid, audio_path(episode_id))
        except Exception as exc:
            logger.exception("Audio download failed for episode %s (video %s): %s", episode_id, ep.guid, exc)
            ep = db.get(PodcastEpisode, episode_id)
            if ep:
                ep.download_status = DOWNLOAD_FAILED
                db.commit()
            return

        ep = db.get(PodcastEpisode, episode_id)
        if ep is None:
            return
        ep.audio_url = f"/api/podcasts/audio/{episode_id}"
        ep.download_status = DOWNLOAD_READY
        db.commit()

        # Auto-transcribe newly downloaded episodes when the toggle is on (and the
        # episode doesn't already have a transcript in progress / ready).
        if get_auto_transcribe(db) and ep.transcript_status in (TRANSCRIPT_NONE, TRANSCRIPT_FAILED):
            ep.transcript_status = TRANSCRIPT_PENDING
            ep.transcript_progress = 0
            db.commit()
            queue_transcription(episode_id)
    finally:
        db.close()


def queue_download(episode_id: uuid.UUID) -> None:
    _download_pool.submit(_download_job, episode_id)


# ── Transcription (faster-whisper) ──────────────────────────────────────

_transcribe_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="transcribe")
_model = None
_model_lock = threading.Lock()


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from faster_whisper import WhisperModel
                logger.info("Loading faster-whisper '%s'…", WHISPER_MODEL)
                _model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    return _model


def _transcribe_job(episode_id: uuid.UUID) -> None:
    db = SessionLocal()
    try:
        ep = db.get(PodcastEpisode, episode_id)
        if ep is None or not ep.audio_url:
            if ep is not None:
                ep.transcript_status = TRANSCRIPT_FAILED
                db.commit()
            return

        ep.transcript_progress = 0
        db.commit()

        path = audio_path(episode_id)
        if not path.exists():
            ep.transcript_status = TRANSCRIPT_FAILED
            db.commit()
            return

        text = ""
        segs: list[dict] = []
        try:
            model = _get_model()
            segments, info = model.transcribe(str(path), language="es", vad_filter=True)
            total_dur = info.duration or 0
            texts: list[str] = []
            last_committed_pct = 0
            for seg in segments:
                seg_text = seg.text.strip()
                if not seg_text:
                    continue
                texts.append(seg_text)
                segs.append({
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg_text,
                })
                if total_dur > 0:
                    pct = min(99, int(seg.end / total_dur * 100))
                    if pct >= last_committed_pct + 5:
                        last_committed_pct = pct
                        _ep = db.get(PodcastEpisode, episode_id)
                        if _ep:
                            _ep.transcript_progress = pct
                            db.commit()
            text = " ".join(texts)
            text = re.sub(r"\s+", " ", text).strip()[:MAX_GENERATED_CHARS]
        except Exception:
            logger.exception("Transcription failed for episode %s", episode_id)
            text = ""
            segs = []

        ep = db.get(PodcastEpisode, episode_id)
        if ep is None:
            return
        if text:
            ep.transcript = text
            ep.segments = segs
            ep.transcript_status = TRANSCRIPT_READY
        else:
            ep.transcript_status = TRANSCRIPT_FAILED
        db.commit()
    finally:
        db.close()


def queue_transcription(episode_id: uuid.UUID) -> None:
    _transcribe_pool.submit(_transcribe_job, episode_id)


# ── Scheduler ────────────────────────────────────────────────────────────

_scheduler: BackgroundScheduler | None = None


def _poll_job() -> None:
    db = SessionLocal()
    try:
        refresh_all_feeds(db)
    except Exception:
        logger.exception("Podcast refresh job failed")
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    sched = BackgroundScheduler(daemon=True, timezone="UTC")
    sched.add_job(
        _poll_job,
        "interval",
        minutes=REFRESH_MINUTES,
        id="podcast_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    sched.start()
    _scheduler = sched
    logger.info("Podcast refresh scheduler started (every %d min)", REFRESH_MINUTES)
    return sched


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
