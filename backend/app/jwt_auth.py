"""JWT 발급과 쿠키 설정을 담당합니다."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

import jwt
from fastapi import Response

from .config import Settings
from .models import SessionUser

ACCESS_TOKEN_COOKIE = "jamissue_access_token"
logger = logging.getLogger(__name__)


def issue_access_token(settings: Settings, user: SessionUser) -> str:
    """세션 사용자 정보를 담은 액세스 토큰을 발급합니다."""

    expires_at = datetime.now(UTC) + settings.access_token_expires_delta
    payload = {
        "sub": user.id,
        "nickname": user.nickname,
        "email": user.email,
        "provider": user.provider,
        "profile_image": user.profile_image,
        "is_admin": user.is_admin,
        "profile_completed_at": user.profile_completed_at,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def auth_cookie_settings(settings: Settings) -> dict[str, object]:
    return {
        "httponly": True,
        "samesite": "lax",
        "secure": settings.auth_cookie_secure,
        "max_age": settings.access_token_max_age_seconds,
        "path": "/",
    }


def set_auth_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(key=ACCESS_TOKEN_COOKIE, value=token, **auth_cookie_settings(settings))


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")


def read_access_token(settings: Settings, token: str | None) -> SessionUser | None:
    """전달받은 JWT를 읽어 세션 사용자로 복원합니다."""

    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        logger.info("Access token expired")
        return None
    except jwt.PyJWTError as error:
        logger.warning("Failed to decode access token", exc_info=error)
        return None

    subject = payload.get("sub")
    nickname = payload.get("nickname")
    provider = payload.get("provider")
    if not subject or not nickname or not provider:
        return None

    return SessionUser(
        id=subject,
        nickname=nickname,
        email=payload.get("email"),
        provider=provider,
        profileImage=payload.get("profile_image"),
        isAdmin=bool(payload.get("is_admin")),
        profileCompletedAt=payload.get("profile_completed_at"),
    )
