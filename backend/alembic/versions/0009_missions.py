"""missions: presaved missions, their vocab, and per-user progress

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-05
"""
import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "missions",
        sa.Column("id", sa.String(length=100), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_index", name="uq_missions_order"),
    )
    op.create_index("ix_missions_order_index", "missions", ["order_index"])

    op.create_table(
        "mission_vocab",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("mission_id", sa.String(length=100), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("spanish", sa.String(length=255), nullable=False),
        sa.Column("english", sa.String(length=255), nullable=False),
        sa.Column("example_sentence", sa.Text(), nullable=True),
        sa.Column("part_of_speech", sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mission_id", "order_index", name="uq_mission_vocab_order"),
    )
    op.create_index("ix_mission_vocab_mission_id", "mission_vocab", ["mission_id"])

    op.create_table(
        "user_missions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("mission_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="available"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "mission_id", name="uq_user_mission"),
    )
    op.create_index("ix_user_missions_user_id", "user_missions", ["user_id"])
    op.create_index("ix_user_missions_mission_id", "user_missions", ["mission_id"])


def downgrade() -> None:
    op.drop_table("user_missions")
    op.drop_table("mission_vocab")
    op.drop_index("ix_missions_order_index", table_name="missions")
    op.drop_table("missions")
