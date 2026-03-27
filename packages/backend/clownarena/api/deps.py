from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.config import get_settings
from clownarena.database import get_db
from clownarena.security import decode_access_token
from clownarena.services.auth import get_user_by_id
from clownarena.services.judge import JudgeGateway
from clownarena.services.realtime import DuelEventBus


def get_event_bus(request: Request) -> DuelEventBus:
    return request.app.state.event_bus


def get_judge_gateway(request: Request) -> JudgeGateway:
    return request.app.state.judge_gateway


def _extract_access_token(request: Request, authorization: str | None) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()
    settings = get_settings()
    return request.cookies.get(settings.session_cookie_name)


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    token = _extract_access_token(request, authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session.")
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = await get_user_by_id(session, payload["sub"])
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user


async def resolve_user_from_token(
    *,
    session: AsyncSession,
    token: str | None,
):
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing session.")
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = await get_user_by_id(session, payload["sub"])
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user
