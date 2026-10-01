"""listening_items.long_form: flag the ~10min two-voice continuous stories

New long-form stories are synthesized once as a single continuous audio file
(services.story_audio) instead of per-sentence, and dock all their checkpoints
at the end instead of interspersing them. See models.listening_item.

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-05
"""
import sqlalchemy as sa

from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "listening_items",
        sa.Column("long_form", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("listening_items", "long_form")
