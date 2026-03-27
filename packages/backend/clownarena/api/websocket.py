from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from clownarena.api.deps import resolve_user_from_token
from clownarena.config import get_settings
from clownarena.database import SessionLocal
from clownarena.services.duels import get_duel, mark_connected, mark_disconnected
from clownarena.services.realtime import DuelEventBus


router = APIRouter(tags=["ws"])


@router.websocket("/ws/duels/{duel_id}")
async def duel_websocket(websocket: WebSocket, duel_id: str) -> None:
    settings = get_settings()
    token = websocket.cookies.get(settings.session_cookie_name) or websocket.query_params.get("token")

    async with SessionLocal() as session:
        try:
            user = await resolve_user_from_token(session=session, token=token)
        except Exception:
            await websocket.close(code=4401)
            return
        try:
            await get_duel(session, duel_id=duel_id, viewer_id=user.id)
        except Exception:
            await websocket.close(code=4403)
            return

    event_bus: DuelEventBus = websocket.app.state.event_bus
    await event_bus.connect(duel_id, websocket)
    async with SessionLocal() as session:
        await mark_connected(session, duel_id=duel_id, user_id=user.id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        async with SessionLocal() as session:
            await mark_disconnected(session, duel_id=duel_id, user_id=user.id, event_bus=event_bus)
        await event_bus.disconnect(duel_id, websocket)
