from __future__ import annotations

import asyncio
import contextlib
import inspect
import secrets
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

from clownarena.config import get_settings
from clownarena.schemas import WebSocketEvent


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DuelEventBus:
    def __init__(self) -> None:
        settings = get_settings()
        self._settings = settings
        self._instance_id = secrets.token_hex(8)
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)
        self._redis: Redis | None = None
        self._listener_task: asyncio.Task | None = None

    async def startup(self) -> None:
        try:
            redis = Redis.from_url(self._settings.redis_url, decode_responses=True)
            ping_result = redis.ping()
            if inspect.isawaitable(ping_result):
                await ping_result
            self._redis = redis
            self._listener_task = asyncio.create_task(self._listen_loop())
        except Exception:
            self._redis = None
            self._listener_task = None

    async def shutdown(self) -> None:
        if self._listener_task:
            self._listener_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._listener_task
        if self._redis:
            await self._redis.aclose()

    async def connect(self, duel_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[duel_id].append(websocket)

    async def disconnect(self, duel_id: str, websocket: WebSocket) -> None:
        if duel_id not in self._connections:
            return
        if websocket in self._connections[duel_id]:
            self._connections[duel_id].remove(websocket)
        if not self._connections[duel_id]:
            self._connections.pop(duel_id, None)

    async def publish(self, duel_id: str, event: str, payload: dict[str, Any]) -> None:
        message = WebSocketEvent(
            event=event,
            duel_id=duel_id,
            payload=payload,
            created_at=utcnow(),
            source_id=self._instance_id,
        )
        await self._broadcast_local(duel_id, message)
        if self._redis is None:
            with contextlib.suppress(Exception):
                self._redis = Redis.from_url(self._settings.redis_url, decode_responses=True)
        if self._redis:
            channel = f"{self._settings.ws_channel_prefix}:{duel_id}"
            await self._redis.publish(channel, message.model_dump_json())
        else:
            await self._broadcast_local(duel_id, message)

    async def _listen_loop(self) -> None:
        assert self._redis is not None
        pubsub = self._redis.pubsub()
        await pubsub.psubscribe(f"{self._settings.ws_channel_prefix}:*")
        async for message in pubsub.listen():
            if message.get("type") != "pmessage":
                continue
            data = message.get("data")
            if not isinstance(data, str):
                continue
            payload = WebSocketEvent.model_validate_json(data)
            if payload.source_id == self._instance_id:
                continue
            await self._broadcast_local(payload.duel_id, payload)

    async def _broadcast_local(self, duel_id: str, message: WebSocketEvent) -> None:
        disconnected: list[WebSocket] = []
        for websocket in self._connections.get(duel_id, []):
            try:
                await websocket.send_text(message.model_dump_json())
            except RuntimeError:
                disconnected.append(websocket)
        for websocket in disconnected:
            await self.disconnect(duel_id, websocket)
