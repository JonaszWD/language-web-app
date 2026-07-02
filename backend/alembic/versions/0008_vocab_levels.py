"""vocab training: card level + word enrichment/image cache

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-30
"""
import sqlalchemy as sa

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_cards",
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("words", sa.Column("enrichment", sa.JSON(), nullable=True))
    op.add_column("words", sa.Column("image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("words", "image_url")
    op.drop_column("words", "enrichment")
    op.drop_column("user_cards", "level")
