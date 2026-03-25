"""공공 행사 데이터를 DB에 적재하고 배너 응답으로 가공합니다."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..config import Settings
from ..db_models import MapPlace, PublicDataSource, PublicEvent, PublicEventMapLink
from ..public_event_models import PublicEventBannerItem, PublicEventBannerResponse
from .event_client import default_event_source_payload, read_public_event_payload
from .event_normalizer import normalize_public_event
from .service import upsert_public_source, utc_now


def extract_event_items(payload: Any) -> list[dict[str, Any]]:
    """
    공공 API가 반환하는 다양한 형태(JSON, dict, list)의 응답 페이로드에서
    실제 행사 정보가 담긴 목록(리스트) 부분을 추출하여 반환합니다.
    """

    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []

    candidates: list[Any] = [
        payload.get("items"),
        payload.get("data"),
        payload.get("records"),
        payload.get("result"),
        payload.get("response", {}).get("body", {}).get("items"),
        payload.get("response", {}).get("body", {}).get("item"),
    ]

    for candidate in candidates:
        if isinstance(candidate, dict):
            if isinstance(candidate.get("item"), list):
                return [item for item in candidate["item"] if isinstance(item, dict)]
            if isinstance(candidate.get("item"), dict):
                return [candidate["item"]]
        if isinstance(candidate, list):
            return [item for item in candidate if isinstance(item, dict)]
    return []


def normalize_match_text(value: str | None) -> str:
    """
    행사장 이름과 앱 내 장소 이름이 일치하는지 비교(매칭)하기 위해,
    공백이나 특수문자를 제거하고 한글과 영문 숫자만 남긴 정규화된 문자열을 만듭니다.
    """

    if not value:
        return ""
    return "".join(ch for ch in value.lower().strip() if ch.isalnum() or "가" <= ch <= "힣")


def find_primary_map_place(db: Session, event: PublicEvent) -> tuple[MapPlace | None, str | None, float]:
    """
    가져온 공공 행사(event)와 가장 밀접하게 관련된 내부 지도 장소(MapPlace)를 찾아 반환합니다.
    매칭은 행사장명(venue_name)이나 행사제목(title)과 내부 장소명을 기반으로 합니다.
    반환 튜플: (찾은 MapPlace 모델, 매칭 방식, 확신도 스코어)
    """

    venue_key = normalize_match_text(event.venue_name)
    title_key = normalize_match_text(event.title)
    if not venue_key and not title_key:
        return None, None, 0.0

    for place in db.scalars(select(MapPlace).where(MapPlace.is_active.is_(True))).all():
        place_key = normalize_match_text(place.name)
        if venue_key and place_key == venue_key:
            return place, "name-exact", 1.0
        if title_key and place_key and place_key in title_key:
            return place, "title-contains", 0.82
    return None, None, 0.0


def upsert_event_map_link(db: Session, event: PublicEvent, place: MapPlace, match_method: str, confidence: float, now: datetime) -> None:
    """
    공공 행사(PublicEvent)와 매칭된 지도 장소(MapPlace) 간의 관계 정보(PublicEventMapLink)를 DB에 저장/갱신합니다.
    새로 발견된 연결 정보는 주(Primary) 연결로 설정됩니다.
    """

    for existing_link in event.map_links:
        existing_link.is_primary = existing_link.position_id == place.position_id
        existing_link.updated_at = now

    link = db.scalars(
        select(PublicEventMapLink).where(
            PublicEventMapLink.public_event_id == event.public_event_id,
            PublicEventMapLink.position_id == place.position_id,
        )
    ).first()
    if not link:
        link = PublicEventMapLink(
            public_event_id=event.public_event_id,
            position_id=place.position_id,
            linked_at=now,
            created_at=now,
        )
        db.add(link)

    link.match_method = match_method
    link.confidence_score = confidence
    link.is_primary = True
    link.updated_at = now


def import_public_events(db: Session, settings: Settings) -> int:
    """
    외부 API 혹은 로컬에서 공공 행사 원본을 읽어들인 후(read_public_event_payload),
    데이터 정규화(normalize_public_event)를 거쳐 DB의 public_event 테이블에 저장 및 갱신합니다.
    새로 추가된 행사 개수를 반환합니다.
    """

    raw_payload = read_public_event_payload(settings)
    source_payload = default_event_source_payload(settings)
    now = utc_now()
    source = upsert_public_source(db, source_payload, now)
    db.flush()

    imported_count = 0
    seen_external_ids: set[str] = set()
    for raw_event in extract_event_items(raw_payload):
        normalized = normalize_public_event(raw_event, settings.public_event_city_keyword)
        if not normalized:
            continue

        event = db.scalars(
            select(PublicEvent).where(
                PublicEvent.source_id == source.source_id,
                PublicEvent.external_id == normalized.external_id,
            )
        ).first()
        created = event is None
        if not event:
            event = PublicEvent(
                source_id=source.source_id,
                external_id=normalized.external_id,
                created_at=now,
            )
            db.add(event)

        event.title = normalized.title
        event.venue_name = normalized.venue_name
        event.district = normalized.district
        event.address = normalized.address
        event.road_address = normalized.road_address
        event.latitude = normalized.latitude
        event.longitude = normalized.longitude
        event.starts_at = normalized.starts_at
        event.ends_at = normalized.ends_at
        event.summary = normalized.summary
        event.description = normalized.description
        event.image_url = normalized.image_url
        event.contact = normalized.contact
        event.source_page_url = normalized.source_page_url
        event.source_updated_at = normalized.source_updated_at
        event.raw_payload = raw_event
        event.normalized_payload = normalized.normalized_payload
        event.sync_status = "imported"
        event.updated_at = now
        db.flush()

        map_place, match_method, confidence = find_primary_map_place(db, event)
        if map_place and match_method:
            upsert_event_map_link(db, event, map_place, match_method, confidence, now)
            event.sync_status = "linked"

        if created:
            imported_count += 1
        seen_external_ids.add(normalized.external_id)

    stale_events = db.scalars(select(PublicEvent).where(PublicEvent.source_id == source.source_id)).all()
    for stale_event in stale_events:
        if stale_event.external_id in seen_external_ids:
            continue
        stale_event.sync_status = "stale"
        stale_event.updated_at = now

    source.last_imported_at = now
    source.updated_at = now
    db.commit()
    return imported_count


def should_refresh_events(source: PublicDataSource | None, settings: Settings) -> bool:
    """
    마지막 가져온 시간(last_imported_at)과 설정된 만료 시간(refresh_minutes)을 비교하여,
    다시 API를 호출해 동기화를 진행할 시점인지 판단합니다.
    """

    if not (settings.public_event_source_url or settings.public_event_file_path.exists()):
        return False
    if not source or not source.last_imported_at:
        return True
    cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=settings.public_event_refresh_minutes)
    return source.last_imported_at <= cutoff


def format_date_label(starts_at: datetime, ends_at: datetime) -> str:
    """
    배너에 표시될 행사 기간을 포맷팅하여 "M월 D일 - M월 D일" 형태의 문자열을 반환합니다.
    시작일과 종료일이 같으면 하루만 표시합니다.
    """

    if starts_at.date() == ends_at.date():
        return f"{starts_at.month}월 {starts_at.day}일"
    return f"{starts_at.month}월 {starts_at.day}일 - {ends_at.month}월 {ends_at.day}일"


def build_public_event_banner_response(db: Session, settings: Settings) -> PublicEventBannerResponse:
    """
    앱의 홈 화면 등에서 행사(배너) 목록을 보여주기 위한 종합 응답(PublicEventBannerResponse)을 조립합니다.
    필요한 경우 `import_public_events`를 호출해 즉시 데이터를 갱신합니다.
    현재 진행 중이거나 예정된 행사만 제한된 개수(limit)만큼 응답에 포함시킵니다.
    """

    source = db.scalars(
        select(PublicDataSource).where(PublicDataSource.source_key == "jamissue-public-event-feed")
    ).first()
    if should_refresh_events(source, settings):
        import_public_events(db, settings)
        source = db.scalars(
            select(PublicDataSource).where(PublicDataSource.source_key == "jamissue-public-event-feed")
        ).first()

    now = datetime.now(UTC).replace(tzinfo=None)
    events = db.scalars(
        select(PublicEvent)
        .options(joinedload(PublicEvent.map_links).joinedload(PublicEventMapLink.place))
        .where(PublicEvent.ends_at >= now)
        .where(PublicEvent.sync_status != "stale")
        .order_by(PublicEvent.starts_at.asc(), PublicEvent.public_event_id.asc())
        .limit(settings.public_event_limit)
    ).unique().all()

    items: list[PublicEventBannerItem] = []
    for event in events:
        primary_link = next((link for link in event.map_links if link.is_primary and link.place), None)
        items.append(
            PublicEventBannerItem(
                id=str(event.public_event_id),
                title=event.title,
                venueName=event.venue_name,
                district=event.district,
                startDate=event.starts_at.strftime("%Y-%m-%d"),
                endDate=event.ends_at.strftime("%Y-%m-%d"),
                dateLabel=format_date_label(event.starts_at, event.ends_at),
                summary=event.summary,
                sourcePageUrl=event.source_page_url,
                linkedPlaceName=primary_link.place.name if primary_link else None,
                isOngoing=event.starts_at <= now <= event.ends_at,
            )
        )

    return PublicEventBannerResponse(
        sourceReady=bool(settings.public_event_source_url or settings.public_event_file_path.exists()),
        sourceName=source.name if source else None,
        importedAt=source.last_imported_at.strftime("%m월 %d일 %H:%M") if source and source.last_imported_at else None,
        items=items,
    )
