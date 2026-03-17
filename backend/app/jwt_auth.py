"""JWT 발급과 복호화를 담당합니다."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt

from .config import Settings
from .models import SessionUser

ACCESS_TOKEN_COOKIE = "jamissue_access_token"


def issue_access_token(settings: Settings, user: SessionUser) -> str:
    """세션 사용자 정보를 담은 액세스 토큰을 발급합니다."""

    expires_at = datetime.now(UTC) + timedelta(minutes=settings.jwt_access_token_minutes)
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


def read_access_token(settings: Settings, token: str | None) -> SessionUser | None:
    """전달받은 JWT를 읽어 세션 사용자로 복원합니다."""

    if not token:
        return None

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
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
