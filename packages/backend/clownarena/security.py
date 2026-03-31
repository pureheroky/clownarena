from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import timedelta
from typing import Any

from fastapi import Response

from clownarena.config import get_settings
from clownarena.database import utcnow


def _cookie_samesite(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in {"lax", "strict", "none"}:
        raise ValueError("SESSION_COOKIE_SAMESITE must be one of: lax, strict, none.")
    return normalized


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * ((4 - len(raw) % 4) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        390_000,
    )
    return f"{salt}${derived.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    salt, digest = password_hash.split("$", maxsplit=1)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        390_000,
    )
    return hmac.compare_digest(derived.hex(), digest)


def create_access_token(subject: str, *, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    expires_at = utcnow() + (expires_delta or timedelta(minutes=settings.access_token_exp_minutes))
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": subject, "exp": int(expires_at.timestamp())}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(
        settings.secret_key.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(signature)}"


def set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.access_token_exp_minutes * 60,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=_cookie_samesite(settings.session_cookie_samesite),
        domain=settings.session_cookie_domain,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.session_cookie_name,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=_cookie_samesite(settings.session_cookie_samesite),
        domain=settings.session_cookie_domain,
        path="/",
    )


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise ValueError("Malformed token.") from exc

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_signature = hmac.new(
        settings.secret_key.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()

    if not hmac.compare_digest(expected_signature, _b64url_decode(signature_b64)):
        raise ValueError("Invalid token signature.")

    payload = json.loads(_b64url_decode(payload_b64))
    if int(payload["exp"]) < int(utcnow().timestamp()):
        raise ValueError("Token expired.")
    return payload
