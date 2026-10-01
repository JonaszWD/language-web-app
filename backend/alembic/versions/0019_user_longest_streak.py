"""user_longest_streak: record the best streak a user has ever reached

streak_count resets to 0 the moment a day is missed, so without a separate
high-water mark the "longest streak" a user ever hit is lost the first time
they break it.

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-26
"""
import sqlalchemy as sa

from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "longest_streak")
