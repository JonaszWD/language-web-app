"""goals: weighted many-to-many goal tagging for missions and users

Replaces the single User.motivation string / Mission.topics list with goals
(catalog), mission_goals (mission -> goal relevance weight), user_goals
(user's ranked goal selection), plus mission_type on missions ('core' |
'bonus') and vocabulary_example_sentences (per-goal flavor variants of a
mission_vocab's example sentence). Mission.topics and User.motivation /
skill_priority are left in place — motivation still drives the single-select
onboarding UI and is bridged into a UserGoal row by
services.missions.sync_user_goal_from_motivation.

Seeds the 9 goals from services.missions.MOTIVATION_TOPIC_MAP's values and
backfills mission_goals from existing Mission.topics and user_goals from
existing User.motivation, so scoring has real data immediately.

Revision ID: 0025
Revises: 0024
Create Date: 2026-07-28
"""
import sqlalchemy as sa

from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None

# key -> display_name, taken verbatim from services.missions.MOTIVATION_TOPIC_MAP's values
_GOALS = [
    ("travel", "Travel"),
    ("work", "Work / business"),
    ("academic", "Academic study"),
    ("relocation", "Living abroad / relocation"),
    ("heritage", "Family or heritage"),
    ("dating", "Dating or a partner"),
    ("social", "Making friends"),
    ("media", "Consuming media"),
    ("gaming", "Gaming / online communities"),
]

# User.motivation string -> goal key, mirrors MOTIVATION_TOPIC_MAP's keys/values 1:1
_MOTIVATION_TO_GOAL_KEY = {
    "Travel": "travel",
    "Work / business": "work",
    "Academic study": "academic",
    "Living abroad / relocation": "relocation",
    "Family or heritage": "heritage",
    "Dating or a partner": "dating",
    "Making friends": "social",
    "Consuming media": "media",
    "Gaming / online communities": "gaming",
}


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_goals_key"),
    )

    op.create_table(
        "mission_goals",
        sa.Column("mission_id", sa.String(length=100), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("relevance_weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("mission_id", "goal_id"),
    )
    op.create_index("ix_mission_goals_goal_id", "mission_goals", ["goal_id"])

    op.create_table(
        "user_goals",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "goal_id"),
    )
    op.create_index("ix_user_goals_user_id", "user_goals", ["user_id"])

    op.add_column(
        "missions",
        sa.Column("mission_type", sa.String(length=20), nullable=False, server_default="core"),
    )

    op.create_table(
        "vocabulary_example_sentences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("mission_vocab_id", sa.Uuid(), nullable=False),
        sa.Column("example_text", sa.Text(), nullable=False),
        sa.Column("goal_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["mission_vocab_id"], ["mission_vocab.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["goal_id"], ["goals.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_vocab_example_sentences_mission_vocab_id",
        "vocabulary_example_sentences",
        ["mission_vocab_id"],
    )

    conn = op.get_bind()

    goals_table = sa.table(
        "goals",
        sa.column("id", sa.Integer),
        sa.column("key", sa.String),
        sa.column("display_name", sa.String),
    )
    conn.execute(
        goals_table.insert(),
        [{"key": key, "display_name": name} for key, name in _GOALS],
    )

    goal_id_by_key = dict(conn.execute(sa.text("SELECT key, id FROM goals")).all())

    # Backfill mission_goals from Mission.topics (relevance_weight=1.0 — the
    # existing data has no notion of partial relevance).
    for mission_id, topics in conn.execute(sa.text("SELECT id, topics FROM missions")).all():
        if not topics:
            continue
        for topic in topics:
            goal_id = goal_id_by_key.get(topic)
            if goal_id is None:
                continue
            conn.execute(
                sa.text(
                    "INSERT INTO mission_goals (mission_id, goal_id, relevance_weight) "
                    "VALUES (:m, :g, 1.0) ON CONFLICT DO NOTHING"
                ),
                {"m": mission_id, "g": goal_id},
            )

    # Backfill user_goals from User.motivation (priority=1 — today's reality
    # is a single motivation per user).
    rows = conn.execute(
        sa.text("SELECT id, motivation FROM users WHERE motivation IS NOT NULL")
    ).all()
    for user_id, motivation in rows:
        goal_id = goal_id_by_key.get(_MOTIVATION_TO_GOAL_KEY.get(motivation, ""))
        if goal_id is None:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO user_goals (user_id, goal_id, priority) "
                "VALUES (:u, :g, 1) ON CONFLICT DO NOTHING"
            ),
            {"u": user_id, "g": goal_id},
        )


def downgrade() -> None:
    op.drop_index("ix_vocab_example_sentences_mission_vocab_id", table_name="vocabulary_example_sentences")
    op.drop_table("vocabulary_example_sentences")
    op.drop_column("missions", "mission_type")
    op.drop_index("ix_user_goals_user_id", table_name="user_goals")
    op.drop_table("user_goals")
    op.drop_index("ix_mission_goals_goal_id", table_name="mission_goals")
    op.drop_table("mission_goals")
    op.drop_table("goals")
