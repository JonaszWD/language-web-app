"""missions: enrichment_status lifecycle column

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-05
"""
import sqlalchemy as sa

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "missions",
        sa.Column(
            "enrichment_status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
    )
    # Any mission whose vocab is already fully enriched is marked ready so the
    # pipeline doesn't re-run for it.
    op.execute(
        """
        UPDATE missions m SET enrichment_status = 'ready'
        WHERE NOT EXISTS (
            SELECT 1 FROM mission_vocab v
            WHERE v.mission_id = m.id AND v.enrichment IS NULL
        )
        AND EXISTS (SELECT 1 FROM mission_vocab v WHERE v.mission_id = m.id)
        """
    )


def downgrade() -> None:
    op.drop_column("missions", "enrichment_status")
