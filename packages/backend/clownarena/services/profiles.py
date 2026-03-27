from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.models import User
from clownarena.schemas import LeaderboardEntryResponse, LeaderboardsResponse


def _entries(users: list[User]) -> list[LeaderboardEntryResponse]:
    return [
        LeaderboardEntryResponse(
            rank=index,
            user_id=user.id,
            username=user.username,
            rating=user.rating,
            clown_tokens_balance=user.clown_tokens_balance,
        )
        for index, user in enumerate(users, start=1)
    ]


async def get_leaderboards(
    session: AsyncSession,
    *,
    limit: int = 25,
) -> LeaderboardsResponse:
    rating_users_result = await session.scalars(
        select(User)
        .order_by(desc(User.rating), desc(User.clown_tokens_balance), User.created_at)
        .limit(limit)
    )
    rating_users = list(rating_users_result.all())
    token_users_result = await session.scalars(
        select(User)
        .order_by(desc(User.clown_tokens_balance), desc(User.rating), User.created_at)
        .limit(limit)
    )
    token_users = list(token_users_result.all())
    return LeaderboardsResponse(
        rating=_entries(rating_users),
        tokens=_entries(token_users),
    )
