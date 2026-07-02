"""podcast feed + episodes

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-14
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "podcast_feeds",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feed_url", sa.String(1000), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("author", sa.String(500), nullable=True),
        sa.Column("image_url", sa.String(1000), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("feed_url"),
    )

    op.create_table(
        "podcast_episodes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("feed_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("guid", sa.String(1000), nullable=True),
        sa.Column("title", sa.String(1000), nullable=False),
        sa.Column("audio_url", sa.String(1000), nullable=True),
        sa.Column("image_url", sa.String(1000), nullable=True),
        sa.Column("duration", sa.String(50), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=False, server_default="Not existing"),
        sa.Column("transcript_url", sa.String(1000), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["feed_id"], ["podcast_feeds.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_podcast_episodes_feed_id", "podcast_episodes", ["feed_id"])


def downgrade() -> None:
    op.drop_index("ix_podcast_episodes_feed_id", table_name="podcast_episodes")
    op.drop_table("podcast_episodes")
    op.drop_table("podcast_feeds")
