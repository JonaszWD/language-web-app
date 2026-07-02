"""add transcript_progress column

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-17
"""
import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "podcast_episodes",
        sa.Column("transcript_progress", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("podcast_episodes", "transcript_progress")
