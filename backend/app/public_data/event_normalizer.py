"""공공 행사 원본 레코드를 배너용 데이터로 정규화합니다."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timedelta
from typing import Any, Mapping

from .event_schemas import NormalizedPublicEvent

TITLE_KEYS = ("title", "eventTitle", "eventNm", "fstvlNm", "축제명", "행사명", "콘텐츠명")
VENUE_KEYS = ("venueName", "venue", "place", "placeName", "행사장소", "개최장소", "축제장소", "fstvlCo")
DISTRICT_KEYS = ("district", "자치구", "구", "구군", "signguNm")
ADDRESS_KEYS = ("address", "addr1", "소재지도로명주소", "소재지지번주소", "주소", "rdnmadr", "lnmadr")
ROAD_ADDRESS_KEYS = ("roadAddress", "도로명주소", "소재지도로명주소", "rdnmadr")
START_KEYS = ("startDate", "eventStartDate", "startDt", "축제시작일자", "행사시작일자", "fstvlStartDate", "beginDate")
END_KEYS = ("endDate", "eventEndDate", "endDt", "축제종료일자", "행사종료일자", "fstvlEndDate", "finishDate")
SUMMARY_KEYS = ("summary", "overview", "한줄소개", "소개", "축제내용")
DESCRIPTION_KEYS = ("description", "detail", "상세내용", "행사내용", "content", "축제내용")
IMAGE_KEYS = ("imageUrl", "image", "대표이미지", "firstimage", "mainImage")
CONTACT_KEYS = ("contact", "tel", "전화번호", "문의및안내")
URL_KEYS = ("sourcePageUrl", "homepage", "homepageUrl", "홈페이지주소", "공식홈페이지")
LATITUDE_KEYS = ("latitude", "lat", "mapY", "위도", "y")
LONGITUDE_KEYS = ("longitude", "lng", "mapX", "경도", "x")
ID_KEYS = ("externalId", "id", "eventId", "contentid", "콘텐츠ID", "축제일련번호")
UPDATED_KEYS = ("sourceUpdatedAt", "modifiedtime", "수정일시", "lastUpdatedAt")


def first_value(payload: Mapping[str, Any], keys: tuple[str, ...]) -> Any:
    """후보 키 순서대로 첫 값을 꺼냅니다."""

    for key in keys:
        value = payload.get(key)
        if value not in (None, "", []):
            return value
    return None


def text_value(payload: Mapping[str, Any], keys: tuple[str, ...]) -> str | None:
    """첫 문자열 값을 정리해서 반환합니다."""

    value = first_value(payload, keys)
    if value in (None, ""):
        return None
    text = str(value).strip()
    return text or None


def float_value(payload: Mapping[str, Any], keys: tuple[str, ...]) -> float | None:
    """첫 좌표 값을 float으로 변환합니다."""

    value = first_value(payload, keys)
    if value in (None, ""):
        return None
    try:
        return float(str(value).strip())
    except ValueError:
        return None


def parse_datetime(value: Any, *, end_of_day: bool = False) -> datetime | None:
    """여러 날짜 문자열 형식을 datetime으로 변환합니다."""

    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)

    text = str(value).strip()
    if not text:
        return None

    if text.isdigit() and len(text) == 8:
        base = datetime.strptime(text, "%Y%m%d")
        return base + timedelta(hours=23, minutes=59, seconds=59) if end_of_day else base

    patterns = (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y.%m.%d",
        "%Y/%m/%d",
    )
    for pattern in patterns:
        try:
            base = datetime.strptime(text, pattern)
            if pattern in {"%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d"} and end_of_day:
                return base + timedelta(hours=23, minutes=59, seconds=59)
            return base
        except ValueError:
            continue
    return None


def derive_district(payload: Mapping[str, Any], city_keyword: str) -> str:
    """행사 레코드에서 자치구를 추출합니다."""

    explicit = text_value(payload, DISTRICT_KEYS)
    if explicit:
        return explicit

    combined = " ".join(
        filter(
            None,
            [
                text_value(payload, ROAD_ADDRESS_KEYS),
                text_value(payload, ADDRESS_KEYS),
                text_value(payload, VENUE_KEYS),
            ],
        )
    )
    match = re.search(r"([가-힣]+구)", combined)
    if match:
        return match.group(1)
    return city_keyword


def build_external_id(payload: Mapping[str, Any], title: str, starts_at: datetime) -> str:
    """원본 ID가 없을 때 안정적인 대체 ID를 만듭니다."""

    explicit = text_value(payload, ID_KEYS)
    if explicit:
        return explicit

    seed = "|".join(
        [
            title,
            starts_at.isoformat(),
            text_value(payload, VENUE_KEYS) or "",
            text_value(payload, ROAD_ADDRESS_KEYS) or text_value(payload, ADDRESS_KEYS) or "",
        ]
    )
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()
    return f"public-event-{digest[:12]}"


def is_target_city(payload: Mapping[str, Any], city_keyword: str) -> bool:
    """대상 도시 키워드가 포함된 행사만 통과시킵니다."""

    haystack = " ".join(
        str(value)
        for value in (
            text_value(payload, DISTRICT_KEYS),
            text_value(payload, ROAD_ADDRESS_KEYS),
            text_value(payload, ADDRESS_KEYS),
            text_value(payload, VENUE_KEYS),
            text_value(payload, TITLE_KEYS),
        )
        if value
    )
    return city_keyword in haystack if city_keyword else True


def normalize_public_event(payload: Mapping[str, Any], city_keyword: str = "대전") -> NormalizedPublicEvent | None:
    """원본 행사 레코드를 배너/DB 저장용으로 정규화합니다."""

    if not is_target_city(payload, city_keyword):
        return None

    title = text_value(payload, TITLE_KEYS)
    if not title:
        return None

    starts_at = parse_datetime(first_value(payload, START_KEYS))
    ends_at = parse_datetime(first_value(payload, END_KEYS), end_of_day=True)
    if not starts_at and not ends_at:
        return None
    if not starts_at:
        starts_at = ends_at.replace(hour=0, minute=0, second=0, microsecond=0)
    if not ends_at:
        ends_at = starts_at + timedelta(hours=23, minutes=59, seconds=59)
    if ends_at < starts_at:
        ends_at = starts_at + timedelta(hours=23, minutes=59, seconds=59)

    venue_name = text_value(payload, VENUE_KEYS)
    district = derive_district(payload, city_keyword)
    address = text_value(payload, ADDRESS_KEYS)
    road_address = text_value(payload, ROAD_ADDRESS_KEYS)
    summary = text_value(payload, SUMMARY_KEYS) or f"{district}에서 열리는 {title} 일정입니다."
    description = text_value(payload, DESCRIPTION_KEYS) or summary
    latitude = float_value(payload, LATITUDE_KEYS)
    longitude = float_value(payload, LONGITUDE_KEYS)
    image_url = text_value(payload, IMAGE_KEYS)
    contact = text_value(payload, CONTACT_KEYS)
    source_page_url = text_value(payload, URL_KEYS)
    source_updated_at = parse_datetime(first_value(payload, UPDATED_KEYS))
    external_id = build_external_id(payload, title, starts_at)

    normalized_payload = {
        "external_id": external_id,
        "title": title,
        "venue_name": venue_name,
        "district": district,
        "address": address,
        "road_address": road_address,
        "latitude": latitude,
        "longitude": longitude,
        "starts_at": starts_at.isoformat(),
        "ends_at": ends_at.isoformat(),
        "summary": summary,
        "description": description,
        "image_url": image_url,
        "contact": contact,
        "source_page_url": source_page_url,
    }

    return NormalizedPublicEvent(
        external_id=external_id,
        title=title,
        venue_name=venue_name,
        district=district,
        address=address,
        road_address=road_address,
        latitude=latitude,
        longitude=longitude,
        starts_at=starts_at,
        ends_at=ends_at,
        summary=summary,
        description=description,
        image_url=image_url,
        contact=contact,
        source_page_url=source_page_url,
        source_updated_at=source_updated_at,
        normalized_payload=normalized_payload,
    )
