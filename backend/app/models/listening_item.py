import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
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

# checkpoint.type values
CHECKPOINT_PREDICT = "predict"
CHECKPOINT_COMPREHENSION = "comprehension"
CHECKPOINT_INFERENCE = "inference"
CHECKPOINT_VOCAB_IN_CONTEXT = "vocab_in_context"
CHECKPOINT_DELAYED_RECALL = "delayed_recall"

# checkpoint.linked_concept_type values
CONCEPT_VOCAB = "vocab"
CONCEPT_GRAMMAR_PATTERN = "grammar_pattern"


class ListeningItem(Base):
    """A generated narrative listening story/dialogue with inline comprehension
    checkpoints. Static content, seeded from backend/content/listening/*.json —
    never edited at runtime (mirrors Mission, see models.mission).

    `id` is a stable human-readable slug, not an autoincrement, so re-seeding is
    idempotent. `scenario_tag` is null for standalone/general items (browsable
    from the Listening tab's picker) or set to a Mission's id when the item was
    generated scoped to that mission's vocab/grammar (see services.mission_gen).
    """

    __tablename__ = "listening_items"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    scenario_tag: Mapped[str | None] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    cefr_level: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Ordered transcript: [{sentence_id, speaker, text_es, text_en}]. No
    # start_ms/end_ms — audio is synthesized per-sentence at playback time (same
    # pattern as ListeningLesson/tts.py), so checkpoints anchor to sentence
    # index, not a timeline offset. See services.listening / ListeningSession.
    sentences: Mapped[list] = mapped_column(JSON, nullable=False)
    # Words (spanish forms) reused from this item's own vocab plus any earlier
    # mission/story vocab, per the shared vocab-reuse constraint system in
    # services.mission_gen (load_known_vocab/lint_vocab).
    vocab_reused: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # True for the long-form (~10 min), two-voice B1 stories: audio is
    # synthesized once as a single continuous file (see services.story_audio,
    # GET /listening/items/{id}/audio) instead of per-sentence via services.tts,
    # and every checkpoint sits at the end (all 5 questions after the final
    # sentence) rather than interspersed. See ListeningSession's long_form branch.
    long_form: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    checkpoints: Mapped[list["ListeningCheckpoint"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="ListeningCheckpoint.after_sentence_id",
    )


class ListeningCheckpoint(Base):
    """One comprehension question inserted at a point in a ListeningItem's
    transcript. Roughly 1 per 30-45s of narrated speech (see services.mission_gen
    story generation) — never over-densified into a quiz.
    """

    __tablename__ = "listening_checkpoints"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    item_id: Mapped[str] = mapped_column(
        ForeignKey("listening_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    after_sentence_id: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # null = free text, graded client-side/best-effort; list = multiple choice.
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    # Ties a wrong answer back into the existing FSRS review queue (see
    # services.listening) — either a Word.spanish form or a GrammarPattern.id.
    linked_concept_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    linked_concept_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    difficulty_tag: Mapped[str | None] = mapped_column(String(20), nullable=True)

    item: Mapped[ListeningItem] = relationship(back_populates="checkpoints")


class UserListeningResult(Base):
    """Per-user, per-item outcome of one listening session. Tracks comprehension
    separately from completion — finishing a story isn't the same as
    understanding it (comprehension_score is checkpoints_correct/total).
    """

    __tablename__ = "user_listening_results"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_user_listening_item"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        ForeignKey("listening_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    comprehension_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    checkpoints_correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    checkpoints_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    replays_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    transcript_reveals: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    speed_reached: Mapped[float | None] = mapped_column(Float, nullable=True)
