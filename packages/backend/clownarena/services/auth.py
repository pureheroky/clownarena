from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from clownarena.config import get_settings
from clownarena.models import User, WalletTransaction
from clownarena.security import hash_password, verify_password
from clownarena.services.errors import ConflictError, UnauthorizedError
from clownarena.enums import WalletTransactionType


async def register_user(
    session: AsyncSession,
    *,
    username: str,
    email: str,
    password: str,
) -> User:
    existing = await session.scalar(
        select(User).where(or_(User.username == username, User.email == email))
    )
    if existing:
        raise ConflictError("Username or email is already in use.")

    settings = get_settings()
    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        rating=settings.default_rating,
        clown_tokens_balance=settings.signup_bonus,
    )
    session.add(user)
    await session.flush()

    session.add(
        WalletTransaction(
            user_id=user.id,
            duel_id=None,
            amount=settings.signup_bonus,
            balance_after=user.clown_tokens_balance,
            transaction_type=WalletTransactionType.SIGNUP_BONUS,
            metadata_json={"reason": "initial_signup_bonus"},
        )
    )
    await session.commit()
    await session.refresh(user)
    return user


async def authenticate_user(session: AsyncSession, *, email: str, password: str) -> User:
    user = await session.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.password_hash):
        raise UnauthorizedError("Invalid email or password.")
    return user


async def get_user_by_id(session: AsyncSession, user_id: str) -> User | None:
    return await session.get(User, user_id)


async def get_user_by_username(session: AsyncSession, username: str) -> User | None:
    return await session.scalar(select(User).where(User.username == username))

