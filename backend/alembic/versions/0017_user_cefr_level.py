"""user_cefr_level: track the learner's current CEFR level on the user row

Drives which CEFR sections (Grammar tab, later Speaking) are unlocked vs
shown-locked for a given user. Defaults every user to A1.

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-19
"""
import sqlalchemy as sa

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("cefr_level", sa.String(length=2), nullable=False, server_default="A1"),
    )


def downgrade() -> None:
    op.drop_column("users", "cefr_level")
