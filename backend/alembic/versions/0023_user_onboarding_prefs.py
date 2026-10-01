"""user_onboarding_prefs: store the learner's onboarding skill priority + motivation

Set post-registration via PATCH /auth/me/onboarding as the learner walks the
/register flow (see frontend/src/app/register/page.tsx's priority/motivation
screens). Nullable — existing users simply have no answer yet.

Revision ID: 0023
Revises: 0022
Create Date: 2026-07-26
"""
import sqlalchemy as sa

from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("skill_priority", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("motivation", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "motivation")
    op.drop_column("users", "skill_priority")
