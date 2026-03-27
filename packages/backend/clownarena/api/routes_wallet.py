from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.api.deps import get_current_user
from clownarena.database import get_db
from clownarena.schemas import DailyClaimResponse, WalletResponse
from clownarena.services.wallet import claim_daily, get_wallet


router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("", response_model=WalletResponse)
async def wallet(user=Depends(get_current_user), session: AsyncSession = Depends(get_db)) -> WalletResponse:
    return await get_wallet(session, user)


@router.post("/daily-claim", response_model=DailyClaimResponse)
async def daily_claim(
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> DailyClaimResponse:
    return await claim_daily(session, user)

