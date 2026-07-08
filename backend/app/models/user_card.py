import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserCard(Base):
    __tablename__ = "user_cards"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    word_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # Minute-precision due time for the vocab-training loop (level-1 self-rating
    # requeues a card in under a minute / 10 min). due_date stays day-granular for
    # FSRS review + stats; due_at drives /vocab/next selection.
    due_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    stability: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    difficulty: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lapses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    state: Mapped[str] = mapped_column(String(20), default="new", nullable=False)
    # Vocabulary-training level 1-5 (see services/vocab). Advances on a correct
    # answer at the current level; 5 = mastered (word then rides normal FSRS review).
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # ── Per-user performance stats for this word (accumulated raw; ratios derived
    # in services/vocab.card_stats). Every answer/review updates these. ──────────
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Correct answers → accuracy = correct_count / attempts.
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Sum of client-reported answer times (ms) → avg response time = total / attempts.
    response_ms_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Sum of confidence per answer (0-100 scale) → avg confidence = sum / attempts.
    confidence_sum: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Total hints revealed across all attempts.
    hints_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Timestamp of the last correct answer → "time since last successful review".
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
