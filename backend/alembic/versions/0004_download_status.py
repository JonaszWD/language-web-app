"""podcast episode download_status

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-17
"""
import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "podcast_episodes",
        sa.Column("download_status", sa.String(20), nullable=False, server_default="none"),
    )
    # Existing episodes that already have an audio_url are considered ready.
    op.execute(
        "UPDATE podcast_episodes SET download_status = 'ready' WHERE audio_url IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("podcast_episodes", "download_status")
