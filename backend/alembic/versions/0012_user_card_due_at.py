"""user_cards: minute-precision due_at for vocab training

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-05
"""
import sqlalchemy as sa

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_cards",
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    # Backfill from the existing day-granular due_date so nothing changes when it's due.
    op.execute("UPDATE user_cards SET due_at = due_date::timestamptz")
    op.create_index("ix_user_cards_due_at", "user_cards", ["due_at"])


def downgrade() -> None:
    op.drop_index("ix_user_cards_due_at", table_name="user_cards")
    op.drop_column("user_cards", "due_at")
