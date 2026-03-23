"""사용자 관리 비즈니스 로직 서비스입니다."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError

from ..db_models import User
from ..models import ProfileUpdateRequest, SessionUser
from ..naver_oauth import NaverProfile
from ..repositories.user_repository import UserRepository

KST = ZoneInfo("Asia/Seoul")


def _utcnow_naive() -> datetime:
    return datetime.now(KST).replace(tzinfo=None)


def _generate_user_id() -> str:
    return f"user-{uuid4().hex[:20]}"


class UserService:
    """회원가입, 닉네임 관리, 프로필 업데이트, 탈퇴 로직을 담당합니다."""

    def __init__(self, user_repo: UserRepository) -> None:
        self.user_repo = user_repo

    # ------------------------------------------------------------------
    # 소셜 로그인 / Identity 연결
    # ------------------------------------------------------------------

    def upsert_social_user(
        self,
        *,
        provider: str,
        provider_user_id: str,
        nickname: str,
        email: str | None = None,
        profile_image: str | None = None,
    ) -> User:
        """외부 로그인 식별자를 내부 고유 user_id 계정에 연결합니다."""
        identity = self.user_repo.find_identity(provider, provider_user_id)
        now = _utcnow_naive()

        if identity:
            user = identity.user
            changed = False
            if user.email != email:
                user.email = email
                changed = True
            if user.provider != provider:
                user.provider = provider
                changed = True
            if identity.email != email:
                identity.email = email
                changed = True
            if identity.profile_image != profile_image:
                identity.profile_image = profile_image
                changed = True
            if changed:
                identity.updated_at = now
                user.updated_at = now
            self.user_repo.flush_and_commit()
            self.user_repo.refresh(user)
            return user

        safe_nickname = self._build_unique_social_nickname(nickname)
        user = User(
            user_id=_generate_user_id(),
            nickname=safe_nickname,
            email=email,
            provider=provider,
            created_at=now,
            updated_at=now,
        )
        self.user_repo.db.add(user)
        self.user_repo.flush()
        self.user_repo.create_identity(user.user_id, provider, provider_user_id, email, profile_image, now)
        try:
            self.user_repo.flush_and_commit()
        except IntegrityError as error:
            self.user_repo.rollback()
            raise ValueError("이미 사용 중인 닉네임이에요.") from error
        self.user_repo.refresh(user)
        return user

    def link_social_identity(
        self,
        *,
        user_id: str,
        provider: str,
        provider_user_id: str,
        email: str | None = None,
        profile_image: str | None = None,
    ) -> User:
        """이미 로그인한 내부 계정에 외부 로그인 수단을 명시적으로 연결합니다."""
        user = self.user_repo.get(user_id)
        if not user:
            raise ValueError("연결할 내부 계정을 찾을 수 없어요.")

        now = _utcnow_naive()
        existing = self.user_repo.find_identity(provider, provider_user_id)
        if existing:
            if existing.user_id != user_id:
                raise ValueError("이미 다른 계정에 연결된 로그인 수단이에요.")
            if existing.email != email or existing.profile_image != profile_image:
                existing.email = email
                existing.profile_image = profile_image
                existing.updated_at = now
                self.user_repo.flush_and_commit()
                self.user_repo.refresh(user)
            return user

        provider_slot = self.user_repo.find_identity_for_user(user_id, provider)
        if provider_slot:
            raise ValueError("이미 이 제공자 계정이 연결되어 있어요.")

        if email and not user.email:
            user.email = email
            user.updated_at = now

        self.user_repo.create_identity(user.user_id, provider, provider_user_id, email, profile_image, now)
        self.user_repo.flush_and_commit()
        self.user_repo.refresh(user)
        return user

    def upsert_naver_user(self, profile: NaverProfile) -> User:
        """네이버 프로필을 기준으로 내부 계정과 소셜 identity를 갱신합니다."""
        nickname = profile.nickname or profile.name or "이름 없음"
        return self.upsert_social_user(
            provider="naver",
            provider_user_id=profile.id,
            nickname=nickname,
            email=profile.email,
            profile_image=profile.profile_image,
        )

    def link_naver_identity(self, user_id: str, profile: NaverProfile) -> User:
        """네이버 identity를 현재 로그인한 내부 계정에 명시적으로 연결합니다."""
        return self.link_social_identity(
            user_id=user_id,
            provider="naver",
            provider_user_id=profile.id,
            email=profile.email,
            profile_image=profile.profile_image,
        )

    # ------------------------------------------------------------------
    # 프로필 업데이트
    # ------------------------------------------------------------------

    def update_profile(self, user_id: str, payload: ProfileUpdateRequest) -> User:
        """닉네임을 검증하고 사용자 프로필을 업데이트합니다."""
        user = self.user_repo.get(user_id)
        if not user:
            raise ValueError("사용자 정보를 찾을 수 없어요.")

        nickname = self._ensure_unique_nickname(payload.nickname, exclude_user_id=user_id)
        now = _utcnow_naive()
        profile_completed_at = user.profile_completed_at if user.profile_completed_at is not None else now
        return self.user_repo.update_profile(user, nickname, profile_completed_at, now)

    # ------------------------------------------------------------------
    # 회원 탈퇴
    # ------------------------------------------------------------------

    def delete_account(self, user_id: str) -> None:
        """사용자를 삭제합니다. User 모델의 cascade 설정으로 연관 데이터가 함께 삭제됩니다."""
        user = self.user_repo.get(user_id)
        if not user:
            raise ValueError("사용자 정보를 찾지 못했어요.")
        self.user_repo.delete(user)

    # ------------------------------------------------------------------
    # DTO 변환
    # ------------------------------------------------------------------

    @staticmethod
    def to_session_user(
        user: User,
        is_admin: bool,
        profile_image: str | None = None,
        provider: str | None = None,
    ) -> SessionUser:
        """사용자 ORM 객체를 세션 응답 모델로 변환합니다."""
        return SessionUser(
            id=user.user_id,
            nickname=user.nickname,
            email=user.email,
            provider=provider or user.provider,
            profileImage=profile_image,
            isAdmin=is_admin,
            profileCompletedAt=user.profile_completed_at.isoformat() if user.profile_completed_at else None,
        )

    # ------------------------------------------------------------------
    # 내부 헬퍼
    # ------------------------------------------------------------------

    def _nickname_exists(self, nickname: str, *, exclude_user_id: str | None = None) -> bool:
        return self.user_repo.nickname_exists(nickname, exclude_user_id=exclude_user_id)

    def _ensure_unique_nickname(self, nickname: str, *, exclude_user_id: str | None = None) -> str:
        """닉네임 유효성을 검증하고 중복이면 에러를 발생시킵니다."""
        normalized = nickname.strip()
        if len(normalized) < 2:
            raise ValueError("닉네임은 두 글자 이상으로 입력해 주세요.")
        if self._nickname_exists(normalized, exclude_user_id=exclude_user_id):
            raise ValueError("이미 사용 중인 닉네임이에요.")
        return normalized

    def _build_unique_social_nickname(self, nickname: str, *, exclude_user_id: str | None = None) -> str:
        """소셜 가입 시 중복 닉네임에 숫자 접미사를 붙여 고유한 닉네임을 만듭니다."""
        base = nickname.strip() or "이름 없음"
        if not self._nickname_exists(base, exclude_user_id=exclude_user_id):
            return base
        for suffix in range(2, 10000):
            candidate = f"{base[:95]}{suffix}"
            if not self._nickname_exists(candidate, exclude_user_id=exclude_user_id):
                return candidate
        raise ValueError("사용 가능한 닉네임을 만들 수 없어요.")
