"""mission_level: tag each mission with its CEFR level

Editorial label (A1/A2/B1/B2/…), seeded from content/missions/*.json
"level" field — display-only, does not gate access or affect ordering.

Revision ID: 0026
Revises: 0025
Create Date: 2026-07-28
"""
import sqlalchemy as sa

from alembic import op

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("missions", sa.Column("level", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("missions", "level")
