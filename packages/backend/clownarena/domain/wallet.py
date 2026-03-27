from __future__ import annotations

from datetime import datetime, timedelta


class WalletError(ValueError):
    pass


def next_daily_claim_at(last_daily_claim_at: datetime | None) -> datetime | None:
    if last_daily_claim_at is None:
        return None
    return last_daily_claim_at + timedelta(hours=24)


def can_claim_daily(last_daily_claim_at: datetime | None, now: datetime) -> bool:
    claim_after = next_daily_claim_at(last_daily_claim_at)
    return claim_after is None or now >= claim_after


def ensure_valid_stake(amount: int, *, min_stake: int, max_stake: int) -> None:
    if amount < min_stake:
        raise WalletError(f"Stake must be at least {min_stake}.")
    if amount > max_stake:
        raise WalletError(f"Stake must not exceed {max_stake}.")


def reserve_stake(balance: int, amount: int) -> int:
    if amount > balance:
        raise WalletError("Insufficient clown tokens.")
    return balance - amount


def payout_stake(balance: int, amount: int) -> int:
    return balance + amount

