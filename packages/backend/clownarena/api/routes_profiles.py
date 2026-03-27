from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.database import get_db
from clownarena.schemas import LeaderboardsResponse, UserResponse
from clownarena.services.auth import get_user_by_username
from clownarena.services.errors import NotFoundError
from clownarena.services.profiles import get_leaderboards


router = APIRouter(tags=["profiles"])


@router.get("/leaderboards", response_model=LeaderboardsResponse)
async def leaderboards(session: AsyncSession = Depends(get_db)) -> LeaderboardsResponse:
    return await get_leaderboards(session)


@router.get("/profile/{username}", response_model=UserResponse)
async def get_profile(username: str, session: AsyncSession = Depends(get_db)) -> UserResponse:
    user = await get_user_by_username(session, username)
    if user is None:
        raise NotFoundError("Profile not found.")
    return UserResponse.model_validate(user)
