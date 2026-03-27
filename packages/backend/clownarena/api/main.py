from __future__ import annotations

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from clownarena.api.routes_auth import router as auth_router
from clownarena.api.routes_duels import router as duel_router
from clownarena.api.routes_profiles import router as profile_router
from clownarena.api.routes_problems import router as problem_router
from clownarena.api.routes_wallet import router as wallet_router
from clownarena.api.websocket import router as websocket_router
from clownarena.config import get_settings
from clownarena.services.errors import DomainError
from clownarena.services.judge import JudgeGateway
from clownarena.services.realtime import DuelEventBus


@asynccontextmanager
async def lifespan(app: FastAPI):
    event_bus = DuelEventBus()
    await event_bus.startup()
    app.state.event_bus = event_bus
    app.state.judge_gateway = JudgeGateway()
    try:
        yield
    finally:
        await event_bus.shutdown()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(DomainError)
    async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_router)
    app.include_router(profile_router)
    app.include_router(wallet_router)
    app.include_router(problem_router)
    app.include_router(duel_router)
    app.include_router(websocket_router)
    return app


app = create_app()


def run() -> None:
    uvicorn.run("clownarena.api.main:app", host="0.0.0.0", port=8000, reload=True)
