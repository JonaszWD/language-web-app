"""mission_context_preview: cache the LLM-generated Context Preview stage

Mirrors missions.speaking — a JSON blob {situation, situation_en, key_phrases}
generated once per mission and cached, regenerated when stale (see
CONTEXT_PREVIEW_VERSION in services.missions).

Revision ID: 0027
Revises: 0026
Create Date: 2026-07-29
"""
import sqlalchemy as sa

from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("missions", sa.Column("context_preview", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("missions", "context_preview")
