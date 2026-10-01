"""listening_items: checkpointed narrative listening stories

New tables only — additive, nothing existing to migrate. Mirrors the
Mission/MissionVocab pattern: ListeningItem/ListeningCheckpoint are static
content seeded from backend/content/listening/*.json (see
scripts/seed_listening_items.py), UserListeningResult is per-user progress
created as users play.

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-21
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "listening_items",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column(
            "scenario_tag",
            sa.String(length=100),
            sa.ForeignKey("missions.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("cefr_level", sa.String(length=10), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("sentences", postgresql.JSON, nullable=False),
        sa.Column("vocab_reused", postgresql.JSON, nullable=False, server_default="[]"),
    )
    op.create_index("ix_listening_items_scenario_tag", "listening_items", ["scenario_tag"])
    op.create_index("ix_listening_items_cefr_level", "listening_items", ["cefr_level"])

    op.create_table(
        "listening_checkpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "item_id",
            sa.String(length=100),
            sa.ForeignKey("listening_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("after_sentence_id", sa.Integer, nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("prompt", sa.Text, nullable=False),
        sa.Column("options", postgresql.JSON, nullable=True),
        sa.Column("correct_answer", sa.Text, nullable=False),
        sa.Column("linked_concept_type", sa.String(length=20), nullable=True),
        sa.Column("linked_concept_id", sa.String(length=255), nullable=True),
        sa.Column("difficulty_tag", sa.String(length=20), nullable=True),
    )
    op.create_index("ix_listening_checkpoints_item_id", "listening_checkpoints", ["item_id"])

    op.create_table(
        "user_listening_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "item_id",
            sa.String(length=100),
            sa.ForeignKey("listening_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("comprehension_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("checkpoints_correct", sa.Integer, nullable=False, server_default="0"),
        sa.Column("checkpoints_total", sa.Integer, nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "item_id", name="uq_user_listening_item"),
    )
    op.create_index("ix_user_listening_results_user_id", "user_listening_results", ["user_id"])
    op.create_index("ix_user_listening_results_item_id", "user_listening_results", ["item_id"])


def downgrade() -> None:
    op.drop_table("user_listening_results")
    op.drop_table("listening_checkpoints")
    op.drop_table("listening_items")
