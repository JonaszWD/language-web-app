"""mission_vocab: cached Gemini enrichment + image

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-05
"""
import sqlalchemy as sa

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("mission_vocab", sa.Column("enrichment", sa.JSON(), nullable=True))
    op.add_column("mission_vocab", sa.Column("image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("mission_vocab", "image_url")
    op.drop_column("mission_vocab", "enrichment")
