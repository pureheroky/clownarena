from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.api.deps import get_current_user
from clownarena.database import get_db
from clownarena.schemas import (
    LoginRequest,
    LogoutResponse,
    RegisterRequest,
    SessionResponse,
    UserResponse,
    WebSocketTokenResponse,
)
from clownarena.security import clear_session_cookie, create_access_token, set_session_cookie
from clownarena.services import auth as auth_service


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=SessionResponse)
async def register(
    payload: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_db),
) -> SessionResponse:
    user = await auth_service.register_user(
        session,
        username=payload.username,
        email=payload.email,
        password=payload.password,
    )
    token = create_access_token(user.id)
    set_session_cookie(response, token)
    return SessionResponse(user=UserResponse.model_validate(user))


@router.post("/login", response_model=SessionResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_db),
) -> SessionResponse:
    user = await auth_service.authenticate_user(session, email=payload.email, password=payload.password)
    token = create_access_token(user.id)
    set_session_cookie(response, token)
    return SessionResponse(user=UserResponse.model_validate(user))


@router.post("/logout", response_model=LogoutResponse)
async def logout(response: Response) -> LogoutResponse:
    clear_session_cookie(response)
    return LogoutResponse()


@router.get("/me", response_model=UserResponse)
async def me(user=Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(user)


@router.get("/ws-token", response_model=WebSocketTokenResponse)
async def websocket_token(user=Depends(get_current_user)) -> WebSocketTokenResponse:
    token = create_access_token(user.id)
    return WebSocketTokenResponse(token=token)
