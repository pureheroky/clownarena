"""add duel room type

Revision ID: 20260326_0002
Revises: 20260325_0001
Create Date: 2026-03-26 15:00:00
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260326_0002"
down_revision = "20260325_0001"
branch_labels = None
depends_on = None


room_type_enum = sa.Enum("rated", "practice", name="duelroomtype")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    room_type_enum.create(bind, checkfirst=True)
    duel_columns = {column["name"] for column in inspector.get_columns("duels")}
    if "room_type" not in duel_columns:
        op.add_column(
            "duels",
            sa.Column("room_type", room_type_enum, nullable=False, server_default="rated"),
        )
        op.alter_column("duels", "room_type", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    duel_columns = {column["name"] for column in inspector.get_columns("duels")}
    if "room_type" in duel_columns:
        op.drop_column("duels", "room_type")
    room_type_enum.drop(bind, checkfirst=True)
