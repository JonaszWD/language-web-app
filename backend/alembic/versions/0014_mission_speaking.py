"""missions: LLM-generated 7-stage speaking role-play

Adds a nullable JSON column holding the progressive speaking script (role,
setting, and the 7 stages) generated once per mission during enrichment.

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-06
"""
import sqlalchemy as sa

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("missions", sa.Column("speaking", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("missions", "speaking")
