from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    return int(value)


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _env_optional_str(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _env_csv(name: str, default: str) -> tuple[str, ...]:
    raw = os.getenv(name, default)
    return tuple(item.strip() for item in raw.split(",") if item.strip())


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Clown Arena API")
    environment: str = os.getenv("ENVIRONMENT", "development")
    secret_key: str = os.getenv("SECRET_KEY", "change-me")
    access_token_exp_minutes: int = _env_int("ACCESS_TOKEN_EXP_MINUTES", 60 * 24)
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/clownarena",
    )
    async_database_url: str = os.getenv(
        "ASYNC_DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/clownarena",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    signup_bonus: int = _env_int("SIGNUP_BONUS_TOKENS", 200)
    daily_claim_amount: int = _env_int("DAILY_CLAIM_AMOUNT", 100)
    min_stake: int = _env_int("MIN_STAKE_TOKENS", 25)
    max_stake: int = _env_int("MAX_STAKE_TOKENS", 500)
    default_rating: int = _env_int("DEFAULT_RATING", 1200)
    duel_countdown_seconds: int = _env_int("DUEL_COUNTDOWN_SECONDS", 3)
    duel_room_expiry_minutes: int = _env_int("DUEL_ROOM_EXPIRY_MINUTES", 15)
    duel_ready_timeout_seconds: int = _env_int("DUEL_READY_TIMEOUT_SECONDS", 60)
    duel_max_duration_seconds: int = _env_int("DUEL_MAX_DURATION_SECONDS", 20 * 60)
    duel_disconnect_grace_seconds: int = _env_int("DUEL_DISCONNECT_GRACE_SECONDS", 60)
    failure_penalty_seconds: int = _env_int("FAILURE_PENALTY_SECONDS", 20)
    judge_python_image: str = os.getenv("JUDGE_PYTHON_IMAGE", "python:3.13-slim")
    judge_memory_mb: int = _env_int("JUDGE_MEMORY_MB", 128)
    judge_time_limit_sec: int = _env_int("JUDGE_TIME_LIMIT_SEC", 2)
    judge_queue_name: str = os.getenv("JUDGE_QUEUE_NAME", "judge")
    ws_channel_prefix: str = os.getenv("WS_CHANNEL_PREFIX", "duel")
    cors_origins: tuple[str, ...] = _env_csv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    cors_origin_regex: str | None = _env_optional_str("CORS_ORIGIN_REGEX")
    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "clownarena_session")
    session_cookie_secure: bool = _env_bool("SESSION_COOKIE_SECURE", False)
    session_cookie_domain: str | None = _env_optional_str("SESSION_COOKIE_DOMAIN")
    session_cookie_samesite: str = os.getenv("SESSION_COOKIE_SAMESITE", "lax").strip().lower()
    db_pool_size: int = _env_int("DB_POOL_SIZE", 5)
    db_max_overflow: int = _env_int("DB_MAX_OVERFLOW", 10)
    db_pool_timeout: int = _env_int("DB_POOL_TIMEOUT", 30)
    db_pool_recycle: int = _env_int("DB_POOL_RECYCLE", 1800)
    db_disable_pooling: bool = _env_bool("DB_DISABLE_POOLING", False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
