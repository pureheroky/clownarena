"""add template seeded flag to problems

Revision ID: 20260327_0004
Revises: 20260326_0003
Create Date: 2026-03-27 00:04:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20260327_0004"
down_revision = "20260326_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("problems")}
    if "is_template_seeded" not in columns:
        op.add_column(
            "problems",
            sa.Column("is_template_seeded", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.alter_column("problems", "is_template_seeded", server_default=None)

    for title, description in (
        (
            "Longest Equal Run",
            "You are given a sequence of integers. Find the length of the longest contiguous block that contains only one repeated value.\n\nIf all numbers are different, the answer is 1.",
        ),
        (
            "Smallest Missing Non-Negative",
            "You are given an array of integers. Find the smallest non-negative integer that does not appear in the array.\n\nFor example, if the array contains 0, 1 and 3, the answer is 2.",
        ),
    ):
        bind.execute(
            text(
                """
                update problems
                set is_template_seeded = true
                where title = :title and description = :description
                """
            ),
            {"title": title, "description": description},
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("problems")}
    if "is_template_seeded" in columns:
        op.drop_column("problems", "is_template_seeded")
