import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    streak_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_study_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cefr_level: Mapped[str] = mapped_column(String(2), default="A1", server_default="A1", nullable=False)
    # Highest streak_count ever reached — streak_count itself resets on a
    # missed day, so this is the only record of a user's best run.
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    # Onboarding preferences (frontend/src/app/register/page.tsx's priority/
    # motivation screens) — null until the learner walks that step. Values are
    # the exact PickOption.name strings from SKILL_PRIORITIES/MOTIVATIONS there.
    skill_priority: Mapped[str | None] = mapped_column(String(30), nullable=True)
    motivation: Mapped[str | None] = mapped_column(String(50), nullable=True)
