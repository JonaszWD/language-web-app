"""add transcript segments column

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-18
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "podcast_episodes",
        sa.Column("segments", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("podcast_episodes", "segments")
