import uuid

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Goal(Base):
    """Canonical catalog of learner goals (travel, work, academic, ...). Small,
    fixed set — admin-managed, not user-created. Seeded in migration 0025."""

    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)


class MissionGoal(Base):
    """How relevant a mission is to a goal (0-1). Drives services.missions'
    scoring — replaces the old boolean Mission.topics tagging."""

    __tablename__ = "mission_goals"

    mission_id: Mapped[str] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), primary_key=True
    )
    goal_id: Mapped[int] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), primary_key=True)
    relevance_weight: Mapped[float] = mapped_column(Float, default=1.0, server_default="1.0", nullable=False)


class UserGoal(Base):
    """A learner's selected goal + its rank (1 = highest priority). Replaces
    the single User.motivation string with a ranked multi-select — see
    services.missions.sync_user_goal_from_motivation for the bridge that
    keeps today's single-select onboarding UI working unchanged."""

    __tablename__ = "user_goals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    goal_id: Mapped[int] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), primary_key=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False)


class VocabularyExampleSentence(Base):
    """A goal-flavored alternate example sentence for one mission_vocab word.
    goal_id NULL is unused in practice — MissionVocab.example_sentence already
    serves as the generic fallback (see services.missions.pick_example_sentence)."""

    __tablename__ = "vocabulary_example_sentences"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    mission_vocab_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("mission_vocab.id", ondelete="CASCADE"), nullable=False, index=True
    )
    example_text: Mapped[str] = mapped_column(Text, nullable=False)
    goal_id: Mapped[int | None] = mapped_column(
        ForeignKey("goals.id", ondelete="SET NULL"), nullable=True
    )
