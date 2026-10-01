import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Canonical skill names — kept in sync with services.skill_stats.SKILLS.
SKILL_RECOGNITION = "recognition"
SKILL_RECALL = "recall"
SKILL_PRONUNCIATION = "pronunciation"
SKILL_LISTENING = "listening"
SKILL_GRAMMAR = "grammar"
SKILL_WRITING = "writing"
SKILL_CONVERSATION = "conversation"


class UserSkillStats(Base):
    """Per-user, per-skill rollup counters across the 7 tracked dimensions
    (recognition/recall/pronunciation/listening/grammar/writing/conversation).

    One row per (user_id, skill), incremented at every existing grading call
    site (vocab answers, writing feedback, grammar review, speaking turns,
    listening results). Mirrors the raw-counters-in/ratios-derived convention
    already used by UserCard's per-word stats (see services.vocab.card_stats)."""

    __tablename__ = "user_skill_stats"
    __table_args__ = (UniqueConstraint("user_id", "skill", name="uq_user_skill"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    skill: Mapped[str] = mapped_column(String(20), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Sum of 0-100 scores (Mistral grades, speech-recognition confidence*100) and
    # how many attempts actually carried one (not every skill's attempts do) →
    # avg_score = score_sum / scored_attempts.
    score_sum: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    scored_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    response_ms_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_practiced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The following are only populated by skills that have a notion of "stage"
    # (the scripted Grammar/Listening/Writing lessons) or a recorded turn
    # (Speaking) — left at their default (0/NULL) for skills that don't.
    max_stage_reached: Mapped[int | None] = mapped_column(Integer, nullable=True)
    replays_total: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    transcript_reveals_total: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    last_speed_reached: Mapped[float | None] = mapped_column(Float, nullable=True)
    retries_total: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    recordings_total: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
