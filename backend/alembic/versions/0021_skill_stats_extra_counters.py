"""skill_stats_extra_counters: stage/replay/speed/retry/recording tracking

Extends user_skill_stats with counters for metrics that don't fit the
existing attempts/correct/score/response_ms shape: highest lesson stage
reached, replays and transcript reveals used (scripted Listening lessons),
last playback speed reached, and retry/recording counts (Speaking). Each
column is only ever populated by the skill(s) it's relevant to — the same
convention response_ms_total already follows (written by vocab, read by all).

Revision ID: 0021
Revises: 0020
Create Date: 2026-07-26
"""
import sqlalchemy as sa

from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_skill_stats", sa.Column("max_stage_reached", sa.Integer(), nullable=True))
    op.add_column("user_skill_stats", sa.Column("replays_total", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_skill_stats", sa.Column("transcript_reveals_total", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_skill_stats", sa.Column("last_speed_reached", sa.Float(), nullable=True))
    op.add_column("user_skill_stats", sa.Column("retries_total", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("user_skill_stats", sa.Column("recordings_total", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("user_skill_stats", "recordings_total")
    op.drop_column("user_skill_stats", "retries_total")
    op.drop_column("user_skill_stats", "last_speed_reached")
    op.drop_column("user_skill_stats", "transcript_reveals_total")
    op.drop_column("user_skill_stats", "replays_total")
    op.drop_column("user_skill_stats", "max_stage_reached")
