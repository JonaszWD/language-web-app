import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Default text stored when a feed/episode has no transcript available.
NO_TRANSCRIPT = "Not existing"

TRANSCRIPT_READY = "ready"
TRANSCRIPT_NONE = "none"
TRANSCRIPT_PENDING = "pending"
TRANSCRIPT_FAILED = "failed"

DOWNLOAD_NONE = "none"
DOWNLOAD_PENDING = "pending"
DOWNLOAD_READY = "ready"
DOWNLOAD_FAILED = "failed"


class PodcastFeed(Base):
    """The single active RSS podcast feed.

    Only one feed exists at a time — adding a new feed replaces the previous
    one (and its episodes via cascade).
    """

    __tablename__ = "podcast_feeds"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    feed_url: Mapped[str] = mapped_column(String(1000), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    episodes: Mapped[list["PodcastEpisode"]] = relationship(
        back_populates="feed",
        cascade="all, delete-orphan",
        order_by="PodcastEpisode.position",
    )


class PodcastEpisode(Base):
    __tablename__ = "podcast_episodes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    feed_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("podcast_feeds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    guid: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    title: Mapped[str] = mapped_column(String(1000), nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    duration: Mapped[str | None] = mapped_column(String(50), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    transcript: Mapped[str] = mapped_column(Text, nullable=False, default=NO_TRANSCRIPT)
    # Per-segment timestamps from speech-to-text: [{"start": s, "end": s, "text": str}, …].
    # Used to sync the transcript highlight with audio playback. Null for episodes
    # transcribed before this column existed (those fall back to plain text, no sync).
    segments: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    transcript_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    transcript_status: Mapped[str] = mapped_column(String(20), nullable=False, default=TRANSCRIPT_NONE)
    transcript_progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    download_status: Mapped[str] = mapped_column(String(20), nullable=False, default=DOWNLOAD_NONE)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    feed: Mapped["PodcastFeed"] = relationship(back_populates="episodes")
