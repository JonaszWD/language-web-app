"""user_mission_last_opened: track when a user last opened a mission

Backs the dashboard's "current mission" — the most recently opened,
non-completed UserMission. Bumped by POST /missions/{id}/start, which
already fires idempotently on every mission open.

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-26
"""
import sqlalchemy as sa

from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_missions",
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_missions", "last_opened_at")
