"""user_cards: per-user performance stats per word

Adds the raw counters/timestamp the app accumulates on every answer so each
saved word carries, per user: accuracy (correct_count / attempts), average
response time (response_ms_total / attempts), average confidence
(confidence_sum / attempts), hint count, attempt count, and time since the last
successful review (now - last_success_at).

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-05
"""
import sqlalchemy as sa

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_cards", sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_cards", sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_cards", sa.Column("response_ms_total", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_cards", sa.Column("confidence_sum", sa.Float(), nullable=False, server_default="0"))
    op.add_column("user_cards", sa.Column("hints_total", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_cards", sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("user_cards", "last_success_at")
    op.drop_column("user_cards", "hints_total")
    op.drop_column("user_cards", "confidence_sum")
    op.drop_column("user_cards", "response_ms_total")
    op.drop_column("user_cards", "correct_count")
    op.drop_column("user_cards", "attempts")
