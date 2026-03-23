"""장소(MapPlace) 데이터 접근 레이어입니다."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db_models import Feed, MapPlace
from ..models import CategoryFilter
from .base import BaseRepository


class PlaceRepository(BaseRepository):
    """MapPlace 테이블에 대한 CRUD 및 조회를 담당합니다."""

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get_by_slug(self, slug: str) -> MapPlace | None:
        """slug 기준으로 장소를 조회합니다 (비활성 장소 포함)."""
        return self.db.scalars(select(MapPlace).where(MapPlace.slug == slug)).first()

    def get_active_by_slug(self, slug: str) -> MapPlace | None:
        """공개 상태의 장소만 slug 기준으로 조회합니다."""
        return self.db.scalars(
            select(MapPlace).where(MapPlace.slug == slug, MapPlace.is_active.is_(True))
        ).first()

    def list_active(self, category: CategoryFilter = "all") -> list[MapPlace]:
        """공개 장소 목록을 카테고리 기준으로 반환합니다."""
        stmt = select(MapPlace).where(MapPlace.is_active.is_(True)).order_by(MapPlace.position_id.asc())
        if category != "all":
            stmt = stmt.where(MapPlace.category == category)
        return list(self.db.scalars(stmt).all())

    def list_all(self) -> list[MapPlace]:
        """활성 여부에 관계없이 모든 장소를 반환합니다."""
        return list(self.db.scalars(select(MapPlace).order_by(MapPlace.is_active.desc(), MapPlace.name.asc())).all())

    def list_all_with_review_count(self) -> list[tuple[MapPlace, int]]:
        """모든 장소와 해당 장소의 후기 수를 함께 반환합니다."""
        rows = self.db.execute(
            select(MapPlace, func.count(Feed.feed_id))
            .outerjoin(Feed, Feed.position_id == MapPlace.position_id)
            .group_by(MapPlace.position_id)
            .order_by(MapPlace.is_active.desc(), MapPlace.name.asc())
        ).all()
        return [(place, int(count)) for place, count in rows]

    def update_visibility(self, place: MapPlace, is_active: bool, updated_at: object) -> MapPlace:
        """장소의 공개 여부를 변경하고 저장합니다."""
        place.is_active = is_active
        place.updated_at = updated_at
        self.db.commit()
        return place

    def count_reviews_for(self, position_id: int) -> int:
        """특정 장소의 후기 수를 반환합니다."""
        return int(
            self.db.scalar(select(func.count()).select_from(Feed).where(Feed.position_id == position_id)) or 0
        )
