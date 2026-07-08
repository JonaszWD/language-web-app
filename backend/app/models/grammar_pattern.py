import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.mission import Mission


class GrammarPattern(Base):
    """One grammar structure taught by a mission (~3 per mission). Static
    content, seeded from the same backend/content/missions/*.json files as
    MissionVocab, under a "grammar" array — never edited at runtime.

    Gives each pattern its own spaced-repetition life beyond the in-lesson
    learn/recognise/produce/review cards: once GrammarLesson ends, the pattern
    would otherwise never be scheduled for review again and decay exactly the
    way spacing research says it will. A UserGrammarCard puts it in the same
    FSRS machinery as vocabulary.
    """

    __tablename__ = "grammar_patterns"
    __table_args__ = (UniqueConstraint("mission_id", "order_index", name="uq_grammar_pattern_order"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    mission_id: Mapped[str] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    pattern: Mapped[str] = mapped_column(String(255), nullable=False)
    gloss: Mapped[str] = mapped_column(Text, nullable=False)
    example_es: Mapped[str] = mapped_column(Text, nullable=False)
    # A cloze prompt for spaced review: cloze_template has a single "______"
    # blank; cloze_answer is what fills it (forgiving-compared, same as vocab).
    cloze_template: Mapped[str] = mapped_column(Text, nullable=False)
    cloze_answer: Mapped[str] = mapped_column(String(255), nullable=False)

    mission: Mapped["Mission"] = relationship(back_populates="grammar")


class UserGrammarCard(Base):
    """Per-user FSRS scheduling state for one GrammarPattern. Mirrors UserCard
    exactly (same schedule() function, same fields) — grammar and vocabulary
    get symmetric treatment instead of vocab alone being spaced."""

    __tablename__ = "user_grammar_cards"
    __table_args__ = (UniqueConstraint("user_id", "pattern_id", name="uq_user_grammar_card"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    pattern_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("grammar_patterns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    due_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    stability: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    difficulty: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lapses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    state: Mapped[str] = mapped_column(String(20), default="new", nullable=False)

    pattern: Mapped[GrammarPattern] = relationship()
