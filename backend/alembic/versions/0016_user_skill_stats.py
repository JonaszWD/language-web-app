"""user_skill_stats: per-user, per-skill rollup counters

One row per (user_id, skill) across the 7 tracked dimensions (recognition,
recall, pronunciation, listening, grammar, writing, conversation), so the
dashboard can show a skill breakdown instead of only the pooled UserCard
attempts/correct_count.

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-08
"""
import sqlalchemy as sa

from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_skill_stats",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("skill", sa.String(length=20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("correct_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("score_sum", sa.Float(), nullable=False, server_default="0"),
        sa.Column("scored_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_ms_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_practiced_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "skill", name="uq_user_skill"),
    )
    op.create_index("ix_user_skill_stats_user_id", "user_skill_stats", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_skill_stats_user_id", table_name="user_skill_stats")
    op.drop_table("user_skill_stats")
