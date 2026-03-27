"""add submission outputs

Revision ID: 20260326_0003
Revises: 20260326_0002
Create Date: 2026-03-26 17:10:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260326_0003"
down_revision = "20260326_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    submission_columns = {column["name"] for column in inspector.get_columns("submissions")}

    if "stdout_text" not in submission_columns:
        op.add_column("submissions", sa.Column("stdout_text", sa.Text(), nullable=True))
    if "stderr_text" not in submission_columns:
        op.add_column("submissions", sa.Column("stderr_text", sa.Text(), nullable=True))
    if "sample_results_json" not in submission_columns:
        op.add_column(
            "submissions",
            sa.Column("sample_results_json", sa.JSON(), nullable=False, server_default="[]"),
        )
        op.alter_column("submissions", "sample_results_json", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    submission_columns = {column["name"] for column in inspector.get_columns("submissions")}

    if "sample_results_json" in submission_columns:
        op.drop_column("submissions", "sample_results_json")
    if "stderr_text" in submission_columns:
        op.drop_column("submissions", "stderr_text")
    if "stdout_text" in submission_columns:
        op.drop_column("submissions", "stdout_text")
