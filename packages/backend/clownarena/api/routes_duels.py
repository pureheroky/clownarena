from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.api.deps import get_current_user, get_event_bus, get_judge_gateway
from clownarena.database import get_db
from clownarena.schemas import (
    DuelCreateRequest,
    DuelJoinRequest,
    DuelResponse,
    MatchHistoryItem,
    SubmissionCreateRequest,
    SubmissionResponse,
)
from clownarena.services.duels import (
    activate_duel_after_countdown,
    create_private_duel,
    get_duel,
    join_private_duel,
    list_match_history,
    ready_up,
    submit_solution,
)
from clownarena.services.judge import JudgeGateway
from clownarena.services.realtime import DuelEventBus


router = APIRouter(prefix="/duels", tags=["duels"])


@router.post("/private", response_model=DuelResponse)
async def create_private_duel_route(
    payload: DuelCreateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> DuelResponse:
    return await create_private_duel(
        session,
        creator=user,
        problem_version_id=payload.problem_version_id,
        room_type=payload.room_type,
        stake_amount=payload.stake_amount,
        max_duration_sec=payload.max_duration_sec,
    )


@router.post("/join-by-code", response_model=DuelResponse)
async def join_by_code_route(
    payload: DuelJoinRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    event_bus: DuelEventBus = Depends(get_event_bus),
) -> DuelResponse:
    return await join_private_duel(
        session,
        challenger=user,
        room_code=payload.room_code,
        event_bus=event_bus,
    )


@router.post("/{duel_id}/ready", response_model=DuelResponse)
async def ready_route(
    duel_id: str,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    event_bus: DuelEventBus = Depends(get_event_bus),
) -> DuelResponse:
    duel = await ready_up(session, user=user, duel_id=duel_id, event_bus=event_bus)
    if duel.status.value == "countdown":
        background_tasks.add_task(activate_duel_after_countdown, duel.id, event_bus)
    return duel


@router.post("/{duel_id}/submit", response_model=SubmissionResponse)
async def submit_route(
    duel_id: str,
    payload: SubmissionCreateRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    judge_gateway: JudgeGateway = Depends(get_judge_gateway),
    event_bus: DuelEventBus = Depends(get_event_bus),
) -> SubmissionResponse:
    return await submit_solution(
        session,
        user=user,
        duel_id=duel_id,
        code=payload.code,
        language=payload.language,
        judge_gateway=judge_gateway,
        event_bus=event_bus,
    )


@router.get("/history", response_model=list[MatchHistoryItem])
async def history_route(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[MatchHistoryItem]:
    return await list_match_history(session, user=user)


@router.get("/{duel_id}", response_model=DuelResponse)
async def get_duel_route(
    duel_id: str,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> DuelResponse:
    return await get_duel(session, duel_id=duel_id, viewer_id=user.id)
