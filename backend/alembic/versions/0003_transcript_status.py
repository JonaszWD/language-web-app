"""podcast episode transcript_status

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-15
"""
import sqlalchemy as sa

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "podcast_episodes",
        sa.Column("transcript_status", sa.String(20), nullable=False, server_default="none"),
    )
    # Backfill: episodes that already have a transcript are "ready".
    op.execute(
        "UPDATE podcast_episodes SET transcript_status = 'ready' "
        "WHERE transcript IS NOT NULL AND transcript <> 'Not existing'"
    )


def downgrade() -> None:
    op.drop_column("podcast_episodes", "transcript_status")
