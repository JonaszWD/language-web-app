"""listening_result_extra_counters: replay/reveal/speed tracking per result

Extends user_listening_results with the same replay/transcript-reveal/speed
counters added to user_skill_stats (0021) for the scripted listening path —
these back the checkpointed-listening equivalents (ListeningSession.tsx).

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-26
"""
import sqlalchemy as sa

from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_listening_results", sa.Column("replays_used", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_listening_results", sa.Column("transcript_reveals", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_listening_results", sa.Column("speed_reached", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_listening_results", "speed_reached")
    op.drop_column("user_listening_results", "transcript_reveals")
    op.drop_column("user_listening_results", "replays_used")
