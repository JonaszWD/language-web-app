"""grammar patterns: per-pattern FSRS scheduling

Grammar structures taught by a mission (~3 each) now get their own spaced
review card, mirroring UserCard, instead of being forgotten the moment a
GrammarLesson ends. grammar_patterns is static seed content (like
mission_vocab); user_grammar_cards is per-user scheduling state.

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-14
"""
import sqlalchemy as sa

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "grammar_patterns",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("mission_id", sa.String(length=100), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("pattern", sa.String(length=255), nullable=False),
        sa.Column("gloss", sa.Text(), nullable=False),
        sa.Column("example_es", sa.Text(), nullable=False),
        sa.Column("cloze_template", sa.Text(), nullable=False),
        sa.Column("cloze_answer", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mission_id", "order_index", name="uq_grammar_pattern_order"),
    )
    op.create_index("ix_grammar_patterns_mission_id", "grammar_patterns", ["mission_id"])

    op.create_table(
        "user_grammar_cards",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("pattern_id", sa.Uuid(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("stability", sa.Float(), nullable=False, server_default="0"),
        sa.Column("difficulty", sa.Float(), nullable=False, server_default="0"),
        sa.Column("reps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lapses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("state", sa.String(length=20), nullable=False, server_default="new"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pattern_id"], ["grammar_patterns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "pattern_id", name="uq_user_grammar_card"),
    )
    op.create_index("ix_user_grammar_cards_user_id", "user_grammar_cards", ["user_id"])
    op.create_index("ix_user_grammar_cards_pattern_id", "user_grammar_cards", ["pattern_id"])
    op.create_index("ix_user_grammar_cards_due_date", "user_grammar_cards", ["due_date"])
    op.create_index("ix_user_grammar_cards_due_at", "user_grammar_cards", ["due_at"])


def downgrade() -> None:
    op.drop_table("user_grammar_cards")
    op.drop_index("ix_grammar_patterns_mission_id", table_name="grammar_patterns")
    op.drop_table("grammar_patterns")
