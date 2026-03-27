from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.config import get_settings
from clownarena.domain.wallet import WalletError, can_claim_daily, next_daily_claim_at, reserve_stake
from clownarena.enums import DuelStakeStatus, WalletTransactionType
from clownarena.models import DuelStake, User, WalletTransaction
from clownarena.schemas import DailyClaimResponse, WalletResponse, WalletTransactionResponse
from clownarena.services.errors import ConflictError


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def apply_wallet_delta(
    session: AsyncSession,
    *,
    user: User,
    amount: int,
    transaction_type: WalletTransactionType,
    duel_id: str | None = None,
    metadata: dict | None = None,
) -> WalletTransaction:
    new_balance = user.clown_tokens_balance + amount
    if new_balance < 0:
        raise ConflictError("Insufficient clown tokens.")

    user.clown_tokens_balance = new_balance
    transaction = WalletTransaction(
        user_id=user.id,
        duel_id=duel_id,
        amount=amount,
        balance_after=new_balance,
        transaction_type=transaction_type,
        metadata_json=metadata or {},
    )
    session.add(transaction)
    await session.flush()
    return transaction


async def reserve_duel_stake(
    session: AsyncSession,
    *,
    duel_id: str,
    user: User,
    amount: int,
) -> DuelStake:
    try:
        reserve_stake(user.clown_tokens_balance, amount)
    except WalletError as exc:
        raise ConflictError(str(exc)) from exc

    await apply_wallet_delta(
        session,
        user=user,
        amount=-amount,
        transaction_type=WalletTransactionType.STAKE_RESERVE,
        duel_id=duel_id,
        metadata={"stake_amount": amount},
    )
    stake = DuelStake(
        duel_id=duel_id,
        user_id=user.id,
        amount=amount,
        status=DuelStakeStatus.RESERVED,
    )
    session.add(stake)
    await session.flush()
    return stake


async def refund_duel_stake(
    session: AsyncSession,
    *,
    user: User,
    stake: DuelStake,
    duel_id: str,
) -> None:
    if stake.status != DuelStakeStatus.RESERVED:
        return
    await apply_wallet_delta(
        session,
        user=user,
        amount=stake.amount,
        transaction_type=WalletTransactionType.STAKE_REFUND,
        duel_id=duel_id,
        metadata={"stake_amount": stake.amount},
    )
    stake.status = DuelStakeStatus.REFUNDED
    stake.settled_at = utcnow()


async def payout_duel_stakes(
    session: AsyncSession,
    *,
    winner: User,
    stakes: list[DuelStake],
    duel_id: str,
) -> None:
    total = sum(stake.amount for stake in stakes)
    await apply_wallet_delta(
        session,
        user=winner,
        amount=total,
        transaction_type=WalletTransactionType.STAKE_PAYOUT,
        duel_id=duel_id,
        metadata={"payout_total": total},
    )
    now = utcnow()
    for stake in stakes:
        stake.status = DuelStakeStatus.PAID_OUT
        stake.settled_at = now


async def get_wallet(session: AsyncSession, user: User) -> WalletResponse:
    transactions_result = await session.scalars(
        select(WalletTransaction)
        .where(WalletTransaction.user_id == user.id)
        .order_by(desc(WalletTransaction.created_at))
        .limit(20)
    )
    transactions = list(transactions_result.all())
    next_claim = next_daily_claim_at(user.last_daily_claim_at)
    return WalletResponse(
        balance=user.clown_tokens_balance,
        last_daily_claim_at=user.last_daily_claim_at,
        next_daily_claim_at=next_claim,
        transactions=[WalletTransactionResponse.model_validate(item) for item in transactions],
    )


async def claim_daily(session: AsyncSession, user: User) -> DailyClaimResponse:
    settings = get_settings()
    now = utcnow()
    if not can_claim_daily(user.last_daily_claim_at, now):
        raise ConflictError("Daily claim is not available yet.")

    user.last_daily_claim_at = now
    await apply_wallet_delta(
        session,
        user=user,
        amount=settings.daily_claim_amount,
        transaction_type=WalletTransactionType.DAILY_CLAIM,
        metadata={"claim_after_hours": 24},
    )
    await session.commit()
    return DailyClaimResponse(
        balance=user.clown_tokens_balance,
        claimed_amount=settings.daily_claim_amount,
        next_daily_claim_at=now + timedelta(hours=24),
    )
