"""사용자(User, UserIdentity) 데이터 접근 레이어입니다."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..db_models import User, UserIdentity
from .base import BaseRepository


class UserRepository(BaseRepository):
    """User 및 UserIdentity 테이블에 대한 CRUD를 담당합니다."""

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, user_id: str) -> User | None:
        """user_id 기준으로 사용자를 조회합니다."""
        return self.db.get(User, user_id)

    def create(
        self,
        user_id: str,
        nickname: str,
        email: str | None,
        provider: str,
        now: datetime,
    ) -> User:
        """새 사용자를 생성합니다."""
        user = User(
            user_id=user_id,
            nickname=nickname,
            email=email,
            provider=provider,
            created_at=now,
            updated_at=now,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_or_create(
        self,
        user_id: str,
        nickname: str | None,
        *,
        email: str | None = None,
        provider: str = "demo",
        now: datetime,
    ) -> User:
        """내부 user_id 기준으로 사용자를 찾거나 새로 만듭니다."""
        user = self.db.get(User, user_id)
        if not user:
            return self.create(user_id, nickname or user_id, email, provider, now)

        dirty = False
        if nickname and user.nickname != nickname:
            user.nickname = nickname
            dirty = True
        if email is not None and user.email != email:
            user.email = email
            dirty = True
        if provider and user.provider != provider:
            user.provider = provider
            dirty = True
        if dirty:
            user.updated_at = now
            self.db.commit()
            self.db.refresh(user)
        return user

    def nickname_exists(self, nickname: str, *, exclude_user_id: str | None = None) -> bool:
        """동일 닉네임(대소문자 무시)이 이미 존재하는지 확인합니다."""
        stmt = select(User.user_id).where(func.lower(User.nickname) == nickname.lower())
        if exclude_user_id:
            stmt = stmt.where(User.user_id != exclude_user_id)
        return self.db.scalar(stmt.limit(1)) is not None

    def find_identity(self, provider: str, provider_user_id: str) -> UserIdentity | None:
        """소셜 로그인 provider + provider_user_id 기준으로 identity를 조회합니다."""
        return self.db.scalars(
            select(UserIdentity)
            .options(joinedload(UserIdentity.user))
            .where(UserIdentity.provider == provider, UserIdentity.provider_user_id == provider_user_id)
        ).first()

    def find_identity_for_user(self, user_id: str, provider: str) -> UserIdentity | None:
        """특정 사용자의 특정 provider identity를 조회합니다."""
        return self.db.scalars(
            select(UserIdentity).where(UserIdentity.user_id == user_id, UserIdentity.provider == provider)
        ).first()

    def create_identity(
        self,
        user_id: str,
        provider: str,
        provider_user_id: str,
        email: str | None,
        profile_image: str | None,
        now: datetime,
    ) -> UserIdentity:
        """소셜 로그인 identity 레코드를 생성합니다."""
        identity = UserIdentity(
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
            profile_image=profile_image,
            created_at=now,
            updated_at=now,
        )
        self.db.add(identity)
        return identity

    def flush_and_commit(self) -> None:
        """flush 후 commit합니다."""
        self.db.commit()

    def flush(self) -> None:
        """현재 세션을 flush합니다."""
        self.db.flush()

    def refresh(self, obj: object) -> None:
        """ORM 객체를 DB에서 새로고침합니다."""
        self.db.refresh(obj)

    def rollback(self) -> None:
        """현재 트랜잭션을 롤백합니다."""
        self.db.rollback()

    def update_profile(
        self,
        user: User,
        nickname: str,
        profile_completed_at: datetime | None,
        now: datetime,
    ) -> User:
        """닉네임 및 프로필 완성 시각을 업데이트합니다."""
        user.nickname = nickname
        user.profile_completed_at = profile_completed_at
        user.updated_at = now
        try:
            self.db.commit()
        except IntegrityError as error:
            self.db.rollback()
            raise ValueError("이미 사용 중인 닉네임이에요.") from error
        self.db.refresh(user)
        return user

    def delete(self, user: User) -> None:
        """사용자를 삭제합니다 (cascade로 연관 데이터도 삭제됩니다)."""
        self.db.delete(user)
        self.db.commit()

    def count_all(self) -> int:
        """전체 사용자 수를 반환합니다."""
        return int(self.db.scalar(select(func.count()).select_from(User)) or 0)
