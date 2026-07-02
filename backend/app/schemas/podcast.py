import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class EpisodeResponse(BaseModel):
    id: uuid.UUID
    guid: Optional[str]
    title: str
    audio_url: Optional[str]
    image_url: Optional[str]
    duration: Optional[str]
    published_at: Optional[datetime]
    transcript: str
    segments: Optional[list[TranscriptSegment]] = None
    transcript_url: Optional[str]
    transcript_status: str
    transcript_progress: int
    download_status: str
    position: int

    model_config = {"from_attributes": True}


class FeedResponse(BaseModel):
    id: uuid.UUID
    feed_url: str
    title: str
    author: Optional[str]
    image_url: Optional[str]
    last_checked_at: Optional[datetime]
    episodes: list[EpisodeResponse]

    model_config = {"from_attributes": True}


class AddFeedRequest(BaseModel):
    feed_url: str


class PodcastSettings(BaseModel):
    auto_transcribe: bool
