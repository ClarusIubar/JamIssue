"""장소·코스·부트스트랩·관리자 요약 비즈니스 로직 서비스입니다."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..config import Settings
from ..db_models import Course, CoursePlace
from ..models import (
    AdminPlaceOut,
    AdminSummaryResponse,
    BootstrapResponse,
    CategoryFilter,
    CourseMood,
    CourseOut,
    MyPageResponse,
    MyStatsOut,
    PlaceOut,
    PublicImportResponse,
)
from ..public_data import import_public_bundle as sync_public_bundle
from ..public_data import load_public_bundle as load_public_bundle_payload
from ..repositories.place_repository import PlaceRepository
from ..repositories.review_repository import ReviewRepository
from ..repositories.stamp_repository import StampRepository
from ..repositories.user_repository import UserRepository
from .review_service import ReviewService
from .stamp_service import StampService
from .user_service import UserService

KST = ZoneInfo("Asia/Seoul")


def _utcnow_naive() -> datetime:
    return datetime.now(KST).replace(tzinfo=None)


def _format_datetime(value: datetime | None) -> str:
    if not value:
        return ""
    return value.strftime("%m. %d. %H:%M")


class PlaceService:
    """장소 조회, 코스 목록, 부트스트랩, 관리자 요약 등을 담당합니다."""

    def __init__(
        self,
        place_repo: PlaceRepository,
        review_repo: ReviewRepository,
        stamp_repo: StampRepository,
        user_repo: UserRepository,
        db: Session,
    ) -> None:
        self.place_repo = place_repo
        self.review_repo = review_repo
        self.stamp_repo = stamp_repo
        self.user_repo = user_repo
        self._db = db

    # ------------------------------------------------------------------
    # 장소 조회
    # ------------------------------------------------------------------

    def list_places(self, category: CategoryFilter = "all") -> list[PlaceOut]:
        """공개 장소 목록을 반환합니다."""
        return [self._to_place_out(p) for p in self.place_repo.list_active(category)]

    def get_place(self, place_id: str) -> PlaceOut:
        """단일 장소 정보를 반환합니다."""
        place = self.place_repo.get_active_by_slug(place_id)
        if not place:
            raise ValueError("장소를 찾을 수 없어요.")
        return self._to_place_out(place)

    # ------------------------------------------------------------------
    # 코스 목록
    # ------------------------------------------------------------------

    def list_courses(self, mood: CourseMood | None = None) -> list[CourseOut]:
        """무드 기준 코스 목록을 반환합니다."""
        stmt = (
            select(Course)
            .options(joinedload(Course.course_places).joinedload(CoursePlace.place))
            .order_by(Course.display_order.asc(), Course.course_id.asc())
        )
        if mood and mood != "전체":
            stmt = stmt.where(Course.mood == mood)
        return [self._to_course_out(c) for c in self._db.scalars(stmt).unique().all()]

    # ------------------------------------------------------------------
    # 부트스트랩
    # ------------------------------------------------------------------

    def get_bootstrap(self, user_id: str | None) -> BootstrapResponse:
        """첫 진입에 필요한 장소, 코스, 후기, 스탬프를 묶어 반환합니다."""
        review_service = ReviewService(self.review_repo, self.place_repo, self.stamp_repo, self.user_repo)
        stamp_service = StampService(self.place_repo, self.stamp_repo, self.user_repo)
        places = self.list_places()
        return BootstrapResponse(
            places=places,
            reviews=review_service.list_reviews(current_user_id=user_id),
            courses=self.list_courses(),
            stamps=stamp_service.get_stamps(user_id),
            hasRealData=bool(places),
        )

    # ------------------------------------------------------------------
    # 관리자
    # ------------------------------------------------------------------

    def get_admin_summary(self, settings: Settings) -> AdminSummaryResponse:
        """관리자 화면에 필요한 운영 지표를 집계합니다."""
        user_count = self.user_repo.count_all()
        review_count = self.review_repo.count_all()
        comment_count = self.review_repo.count_all_comments()
        stamp_count = self.stamp_repo.count_all()
        place_rows = self.place_repo.list_all_with_review_count()
        place_count = len(place_rows)

        return AdminSummaryResponse(
            userCount=user_count,
            placeCount=place_count,
            reviewCount=review_count,
            commentCount=comment_count,
            stampCount=stamp_count,
            sourceReady=settings.public_data_file_path.exists() or bool(settings.public_data_source_url),
            places=[
                self._to_admin_place_out(place, count)
                for place, count in place_rows
            ],
        )

    def update_place_visibility(self, place_id: str, is_active: bool) -> AdminPlaceOut:
        """장소의 공개 여부를 변경합니다."""
        place = self.place_repo.get_by_slug(place_id)
        if not place:
            raise ValueError("장소를 찾을 수 없어요.")
        updated = self.place_repo.update_visibility(place, is_active, _utcnow_naive())
        review_count = self.place_repo.count_reviews_for(updated.position_id)
        return self._to_admin_place_out(updated, review_count)

    def import_public_bundle(self, settings: Settings) -> PublicImportResponse:
        """공공 데이터를 임포트합니다."""
        return sync_public_bundle(self._db, settings)

    def load_public_bundle(self, settings: Settings) -> dict:
        """공공 데이터 번들을 딕셔너리로 반환합니다."""
        return load_public_bundle_payload(settings).model_dump(by_alias=True, exclude_none=True)

    # ------------------------------------------------------------------
    # 마이페이지
    # ------------------------------------------------------------------

    def get_my_page(self, user_id: str, is_admin: bool) -> MyPageResponse:
        """마이페이지에 필요한 사용자 요약 정보를 조합해 반환합니다."""
        from ..user_routes_normalized import list_user_routes_for_owner

        user = self.user_repo.get(user_id)
        if not user:
            raise ValueError("사용자 정보를 찾을 수 없어요.")

        review_svc = ReviewService(self.review_repo, self.place_repo, self.stamp_repo, self.user_repo)
        stamp_svc = StampService(self.place_repo, self.stamp_repo, self.user_repo)
        user_svc = UserService(self.user_repo)

        reviews = review_svc.list_reviews(user_id=user_id, current_user_id=user_id)
        stamp_state = stamp_svc.get_stamps(user_id)
        active_places = self.place_repo.list_active()
        visited_place_ids = set(stamp_state.collected_place_ids)
        visited_places = [self._to_place_out(p) for p in active_places if p.slug in visited_place_ids]
        unvisited_places = [self._to_place_out(p) for p in active_places if p.slug not in visited_place_ids]
        routes = list_user_routes_for_owner(self._db, user_id)
        comments = review_svc.build_my_comments(user_id)

        return MyPageResponse(
            user=user_svc.to_session_user(user, is_admin),
            stats=MyStatsOut(
                reviewCount=len(reviews),
                stampCount=len(stamp_state.logs),
                uniquePlaceCount=len(visited_places),
                totalPlaceCount=len(active_places),
                routeCount=len(routes),
            ),
            reviews=reviews,
            comments=comments,
            stampLogs=stamp_state.logs,
            travelSessions=stamp_state.travel_sessions,
            visitedPlaces=visited_places,
            unvisitedPlaces=unvisited_places,
            collectedPlaces=visited_places,
            routes=routes,
        )

    # ------------------------------------------------------------------
    # DTO 변환
    # ------------------------------------------------------------------

    @staticmethod
    def _to_place_out(place) -> PlaceOut:
        return PlaceOut(
            id=place.slug,
            positionId=str(place.position_id),
            name=place.name,
            district=place.district,
            category=place.category,
            jamColor=place.jam_color,
            accentColor=place.accent_color,
            imageUrl=place.image_url,
            latitude=place.latitude,
            longitude=place.longitude,
            summary=place.summary,
            description=place.description,
            vibeTags=list(place.vibe_tags or []),
            visitTime=place.visit_time,
            routeHint=place.route_hint,
            stampReward=place.stamp_reward,
            heroLabel=place.hero_label,
        )

    @staticmethod
    def _to_course_out(course: Course) -> CourseOut:
        ordered = sorted(course.course_places, key=lambda item: item.stop_order)
        return CourseOut(
            id=course.slug,
            title=course.title,
            mood=course.mood,
            duration=course.duration,
            note=course.note,
            color=course.color,
            placeIds=[item.place.slug for item in ordered],
        )

    @staticmethod
    def _to_admin_place_out(place, review_count: int) -> AdminPlaceOut:
        return AdminPlaceOut(
            id=place.slug,
            name=place.name,
            district=place.district,
            category=place.category,
            isActive=place.is_active,
            reviewCount=review_count,
            updatedAt=_format_datetime(place.updated_at),
        )
