"""위치 기반 스탬프 비즈니스 로직 서비스입니다."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from math import asin, cos, radians, sin, sqrt
from zoneinfo import ZoneInfo

from ..db_models import MapPlace, TravelSession, UserRoute, UserStamp
from ..models import StampLogOut, StampState, TravelSessionOut
from ..repositories.place_repository import PlaceRepository
from ..repositories.stamp_repository import StampRepository
from ..repositories.user_repository import UserRepository

KST = ZoneInfo("Asia/Seoul")


def _utcnow_naive() -> datetime:
    return datetime.now(KST).replace(tzinfo=None)


def _to_seoul_date(value: datetime | None = None):
    from datetime import date
    if value is None:
        return datetime.now(KST).date()
    if value.tzinfo is None:
        return value.date()
    return value.astimezone(KST).date()


def _format_datetime(value: datetime | None) -> str:
    if not value:
        return ""
    return value.strftime("%m. %d. %H:%M")


def _format_date(value) -> str:
    from datetime import date
    if value is None:
        return ""
    if isinstance(value, datetime):
        return _to_seoul_date(value).isoformat()
    return value.isoformat()


def _format_visit_label(visit_number: int | None) -> str:
    safe = visit_number if visit_number and visit_number > 0 else 1
    return f"{safe}번째 방문"


class StampService:
    """위치 기반 거리 계산 및 스탬프 적립 조건 검증을 담당합니다."""

    def __init__(
        self,
        place_repo: PlaceRepository,
        stamp_repo: StampRepository,
        user_repo: UserRepository,
    ) -> None:
        self.place_repo = place_repo
        self.stamp_repo = stamp_repo
        self.user_repo = user_repo

    # ------------------------------------------------------------------
    # 거리 계산 (순수 비즈니스 로직 – DB 불필요)
    # ------------------------------------------------------------------

    @staticmethod
    def calculate_distance_meters(
        start_latitude: float,
        start_longitude: float,
        end_latitude: float,
        end_longitude: float,
    ) -> float:
        """두 좌표 사이의 거리를 Haversine 공식으로 미터 단위 계산합니다."""
        earth_radius_meters = 6_371_000
        latitude_delta = radians(end_latitude - start_latitude)
        longitude_delta = radians(end_longitude - start_longitude)
        start_lat_rad = radians(start_latitude)
        end_lat_rad = radians(end_latitude)
        haversine = (
            sin(latitude_delta / 2) ** 2
            + cos(start_lat_rad) * cos(end_lat_rad) * sin(longitude_delta / 2) ** 2
        )
        return earth_radius_meters * (2 * asin(sqrt(haversine)))

    def ensure_within_radius(
        self,
        place: MapPlace,
        current_latitude: float,
        current_longitude: float,
        radius_meters: int,
    ) -> None:
        """현재 위치가 장소 반경 안인지 검증합니다."""
        distance = self.calculate_distance_meters(
            current_latitude, current_longitude, place.latitude, place.longitude
        )
        if distance > radius_meters:
            raise PermissionError(
                f"{place.name} 현장 반경 {radius_meters}m 안에 도착해야 스탬프를 받을 수 있어요. "
                f"현재 약 {round(distance)}m 떨어져 있어요."
            )

    # ------------------------------------------------------------------
    # 스탬프 적립
    # ------------------------------------------------------------------

    def toggle_stamp(
        self,
        user_id: str,
        place_id: str,
        latitude: float,
        longitude: float,
        radius_meters: int,
    ) -> StampState:
        """현장 반경 검증 후 스탬프를 적립합니다. 오늘 이미 적립했으면 현재 상태를 반환합니다."""
        now = _utcnow_naive()
        self.user_repo.get_or_create(user_id, user_id, now=now)

        place = self.place_repo.get_active_by_slug(place_id)
        if not place:
            raise ValueError("장소를 찾을 수 없어요.")

        stamp_date = _to_seoul_date(now)
        existing_today = self.stamp_repo.get_today(user_id, place.position_id, stamp_date)
        if existing_today:
            return self.get_stamps(user_id)

        self.ensure_within_radius(place, latitude, longitude, radius_meters)

        visit_count = self.stamp_repo.count_visits(user_id, place.position_id)
        last_stamp = self.stamp_repo.get_last(user_id)
        session = self._find_or_create_travel_session(user_id, now, last_stamp)

        self.stamp_repo.add(
            user_id=user_id,
            position_id=place.position_id,
            travel_session_id=session.travel_session_id,
            stamp_date=stamp_date,
            visit_ordinal=int(visit_count) + 1,
            now=now,
        )
        return self.get_stamps(user_id)

    def get_stamps(self, user_id: str | None) -> StampState:
        """사용자의 스탬프 상태를 반환합니다."""
        if not user_id:
            return StampState(collectedPlaceIds=[], logs=[], travelSessions=[])

        stamp_rows = self.stamp_repo.get_all_with_place(user_id)

        collected_place_ids: list[str] = []
        seen_place_ids: set[str] = set()
        for stamp in sorted(stamp_rows, key=lambda s: (s.created_at, s.stamp_id)):
            if not stamp.place or not stamp.place.is_active:
                continue
            if stamp.place.slug in seen_place_ids:
                continue
            seen_place_ids.add(stamp.place.slug)
            collected_place_ids.append(stamp.place.slug)

        travel_sessions = self.stamp_repo.list_travel_sessions(user_id)
        owner_routes = self.stamp_repo.list_owner_routes(user_id)

        return StampState(
            collectedPlaceIds=collected_place_ids,
            logs=self._build_stamp_logs(stamp_rows),
            travelSessions=self._build_travel_sessions(travel_sessions, stamp_rows, owner_routes),
        )

    # ------------------------------------------------------------------
    # 내부 헬퍼
    # ------------------------------------------------------------------

    def _find_or_create_travel_session(
        self, user_id: str, now: datetime, last_stamp: UserStamp | None
    ) -> TravelSession:
        if last_stamp and now - last_stamp.created_at <= timedelta(hours=24):
            if last_stamp.travel_session_id:
                session = self.stamp_repo.get_travel_session(last_stamp.travel_session_id)
                if session:
                    self.stamp_repo.update_travel_session(session, ended_at=now, now=now)
                    return session

            session = self.stamp_repo.create_travel_session(
                user_id=user_id,
                started_at=last_stamp.created_at,
                ended_at=now,
                stamp_count=2,
                now=now,
            )
            last_stamp.travel_session_id = session.travel_session_id
            return session

        return self.stamp_repo.create_travel_session(
            user_id=user_id,
            started_at=now,
            ended_at=now,
            stamp_count=1,
            now=now,
        )

    @staticmethod
    def _build_stamp_logs(stamps: list[UserStamp]) -> list[StampLogOut]:
        today_key = _to_seoul_date().isoformat()
        ordered = sorted(stamps, key=lambda s: (s.created_at, s.stamp_id), reverse=True)
        return [
            StampLogOut(
                id=str(stamp.stamp_id),
                placeId=stamp.place.slug,
                placeName=stamp.place.name,
                stampedAt=_format_datetime(stamp.created_at),
                stampedDate=_format_date(stamp.stamp_date),
                visitNumber=stamp.visit_ordinal,
                visitLabel=_format_visit_label(stamp.visit_ordinal),
                travelSessionId=str(stamp.travel_session_id) if stamp.travel_session_id else None,
                isToday=_format_date(stamp.stamp_date) == today_key,
            )
            for stamp in ordered
            if stamp.place and stamp.place.is_active
        ]

    @staticmethod
    def _build_session_duration_label(session: TravelSession) -> str:
        diff = max(session.ended_at - session.started_at, timedelta())
        diff_days = diff.days
        if diff_days <= 0:
            return f"당일 코스 · 스탬프 {session.stamp_count}개"
        return f"{diff_days}박 {diff_days + 1}일 · 스탬프 {session.stamp_count}개"

    def _build_travel_sessions(
        self,
        sessions: list[TravelSession],
        user_stamps: list[UserStamp],
        owner_routes: list[UserRoute],
    ) -> list[TravelSessionOut]:
        stamps_by_session: dict[int, list[UserStamp]] = defaultdict(list)
        for stamp in user_stamps:
            if stamp.travel_session_id:
                stamps_by_session[stamp.travel_session_id].append(stamp)

        published_route_id_by_session = {
            route.travel_session_id: str(route.route_id)
            for route in owner_routes
            if route.travel_session_id is not None
        }

        payloads: list[TravelSessionOut] = []
        for session in sorted(sessions, key=lambda s: (s.started_at, s.travel_session_id), reverse=True):
            ordered_stamps = sorted(
                stamps_by_session.get(session.travel_session_id, []),
                key=lambda s: (s.created_at, s.stamp_id),
            )
            unique_place_ids: list[str] = []
            unique_place_names: list[str] = []
            seen: set[str] = set()
            for stamp in ordered_stamps:
                if not stamp.place or not stamp.place.is_active:
                    continue
                if stamp.place.slug in seen:
                    continue
                seen.add(stamp.place.slug)
                unique_place_ids.append(stamp.place.slug)
                unique_place_names.append(stamp.place.name)

            payloads.append(
                TravelSessionOut(
                    id=str(session.travel_session_id),
                    startedAt=session.started_at.isoformat(),
                    endedAt=session.ended_at.isoformat(),
                    durationLabel=self._build_session_duration_label(session),
                    stampCount=session.stamp_count,
                    placeIds=unique_place_ids,
                    placeNames=unique_place_names,
                    canPublish=len(unique_place_ids) >= 2,
                    publishedRouteId=published_route_id_by_session.get(session.travel_session_id),
                    coverPlaceId=unique_place_ids[0] if unique_place_ids else None,
                )
            )
        return payloads
