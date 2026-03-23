"""스탬프(UserStamp, TravelSession) 데이터 접근 레이어입니다."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..db_models import TravelSession, UserRoute, UserStamp
from .base import BaseRepository


class StampRepository(BaseRepository):
    """UserStamp 및 TravelSession 테이블에 대한 CRUD를 담당합니다."""

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get_today(self, user_id: str, position_id: int, stamp_date: date) -> UserStamp | None:
        """오늘 날짜 기준으로 해당 장소의 스탬프를 조회합니다."""
        return self.db.scalars(
            select(UserStamp).where(
                UserStamp.user_id == user_id,
                UserStamp.position_id == position_id,
                UserStamp.stamp_date == stamp_date,
            )
        ).first()

    def get_all_with_place(self, user_id: str) -> list[UserStamp]:
        """사용자의 모든 스탬프를 장소 정보와 함께 반환합니다."""
        return list(
            self.db.scalars(
                select(UserStamp)
                .options(joinedload(UserStamp.place))
                .where(UserStamp.user_id == user_id)
                .order_by(UserStamp.created_at.desc(), UserStamp.stamp_id.desc())
            ).unique().all()
        )

    def count_visits(self, user_id: str, position_id: int) -> int:
        """특정 사용자가 특정 장소를 방문한 스탬프 수를 반환합니다."""
        return int(
            self.db.scalar(
                select(func.count()).select_from(UserStamp).where(
                    UserStamp.user_id == user_id,
                    UserStamp.position_id == position_id,
                )
            ) or 0
        )

    def get_last(self, user_id: str) -> UserStamp | None:
        """사용자의 가장 최근 스탬프를 반환합니다."""
        return self.db.scalars(
            select(UserStamp)
            .where(UserStamp.user_id == user_id)
            .order_by(UserStamp.created_at.desc(), UserStamp.stamp_id.desc())
            .limit(1)
        ).first()

    def add(
        self,
        user_id: str,
        position_id: int,
        travel_session_id: int | None,
        stamp_date: date,
        visit_ordinal: int,
        now: datetime,
    ) -> UserStamp:
        """스탬프를 적립하고 저장합니다."""
        stamp = UserStamp(
            user_id=user_id,
            position_id=position_id,
            travel_session_id=travel_session_id,
            stamp_date=stamp_date,
            visit_ordinal=visit_ordinal,
            created_at=now,
        )
        self.db.add(stamp)
        self.db.commit()
        return stamp

    def get_travel_session(self, session_id: int) -> TravelSession | None:
        """travel_session_id로 여행 세션을 조회합니다."""
        return self.db.get(TravelSession, session_id)

    def create_travel_session(
        self,
        user_id: str,
        started_at: datetime,
        ended_at: datetime,
        stamp_count: int,
        now: datetime,
    ) -> TravelSession:
        """새 여행 세션을 생성합니다."""
        session = TravelSession(
            user_id=user_id,
            started_at=started_at,
            ended_at=ended_at,
            last_stamp_at=ended_at,
            stamp_count=stamp_count,
            created_at=now,
            updated_at=now,
        )
        self.db.add(session)
        self.db.flush()
        return session

    def update_travel_session(
        self,
        session: TravelSession,
        ended_at: datetime,
        now: datetime,
    ) -> TravelSession:
        """여행 세션의 종료 시각과 스탬프 수를 갱신합니다."""
        session.ended_at = ended_at
        session.last_stamp_at = ended_at
        session.stamp_count += 1
        session.updated_at = now
        return session

    def list_travel_sessions(self, user_id: str) -> list[TravelSession]:
        """사용자의 여행 세션 목록을 반환합니다."""
        return list(
            self.db.scalars(
                select(TravelSession)
                .where(TravelSession.user_id == user_id)
                .order_by(TravelSession.started_at.desc(), TravelSession.travel_session_id.desc())
            ).all()
        )

    def list_owner_routes(self, user_id: str) -> list[UserRoute]:
        """사용자가 생성한 경로 목록을 반환합니다."""
        return list(
            self.db.scalars(
                select(UserRoute)
                .where(UserRoute.user_id == user_id)
                .order_by(UserRoute.created_at.desc(), UserRoute.route_id.desc())
            ).all()
        )

    def flush(self) -> None:
        """현재 세션을 flush합니다."""
        self.db.flush()

    def commit(self) -> None:
        """현재 세션을 commit합니다."""
        self.db.commit()

    def get_stamp_by_id(self, stamp_id: int) -> UserStamp | None:
        """stamp_id로 스탬프를 조회합니다."""
        return self.db.scalars(
            select(UserStamp)
            .options(joinedload(UserStamp.place))
            .where(UserStamp.stamp_id == stamp_id)
        ).first()

    def count_all(self) -> int:
        """전체 스탬프 수를 반환합니다."""
        return int(self.db.scalar(select(func.count()).select_from(UserStamp)) or 0)
