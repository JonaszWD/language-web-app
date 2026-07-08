import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.grammar_pattern import GrammarPattern

# user_mission.status values
MISSION_LOCKED = "locked"
MISSION_AVAILABLE = "available"
MISSION_COMPLETED = "completed"

# mission.enrichment_status values — the Gemini pipeline runs once per mission
ENRICH_PENDING = "pending"        # never run
ENRICH_PROCESSING = "processing"  # running now
ENRICH_READY = "ready"            # all words enriched


class Mission(Base):
    """A presaved learning mission. Static content, seeded from
    backend/content/missions/*.json — never edited at runtime.

    `id` is a stable human-readable slug (e.g. "m001-coffee-shop"), NOT an
    autoincrement, so re-seeding is idempotent and IDs match across local/prod.
    """

    __tablename__ = "missions"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Gemini enrichment lifecycle — pending → processing → ready. Gated so the
    # pipeline only runs on the first open (see services.missions).
    enrichment_status: Mapped[str] = mapped_column(
        String(20), default=ENRICH_PENDING, server_default=ENRICH_PENDING, nullable=False
    )
    # The progressive 7-stage speaking role-play, generated once by the LLM
    # during enrichment (see services.missions._generate_speaking). Shape:
    # {role, role_en, setting, stages: [{n, type, ...}]}. Null until generated.
    speaking: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    vocab: Mapped[list["MissionVocab"]] = relationship(
        back_populates="mission",
        cascade="all, delete-orphan",
        order_by="MissionVocab.order_index",
    )
    grammar: Mapped[list["GrammarPattern"]] = relationship(
        back_populates="mission",
        cascade="all, delete-orphan",
        order_by="GrammarPattern.order_index",
    )


class MissionVocab(Base):
    """One vocabulary item belonging to a mission (~20 per mission).

    Self-contained (spanish/english/example) so a mission is fully described by
    its JSON file. When a user starts a mission the study service can mint the
    corresponding `words` + `user_cards` rows for FSRS.
    """

    __tablename__ = "mission_vocab"
    __table_args__ = (UniqueConstraint("mission_id", "order_index", name="uq_mission_vocab_order"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    mission_id: Mapped[str] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    spanish: Mapped[str] = mapped_column(String(255), nullable=False)
    english: Mapped[str] = mapped_column(String(255), nullable=False)
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)
    part_of_speech: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Cached Gemini enrichment (same shape as words.enrichment: gender, synonyms,
    # collocations, chunks, example sentences, …). Generated in the background the
    # first time the mission is opened; see services.missions.
    enrichment: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Cached Pexels image for the word, fetched alongside enrichment.
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    mission: Mapped[Mission] = relationship(back_populates="vocab")


class UserMission(Base):
    """Per-user progress through a mission. NOT seeded — created as users play."""

    __tablename__ = "user_missions"
    __table_args__ = (UniqueConstraint("user_id", "mission_id", name="uq_user_mission"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mission_id: Mapped[str] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default=MISSION_AVAILABLE, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
