"""공공 행사 원본 응답을 읽는 클라이언트입니다."""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse
from urllib.request import Request, urlopen

from ..config import Settings
from .schemas import PublicSourcePayload

DEFAULT_EVENT_SOURCE_KEY = "jamissue-public-event-feed"


def default_event_source_payload(settings: Settings) -> PublicSourcePayload:
    """
    현재 설정(Settings)을 기준으로 공공 행사 API 혹은 로컬 JSON 파일의 출처 메타데이터를 생성합니다.
    """

    source_url = settings.public_event_source_url or str(settings.public_event_file_path)
    provider = "public-api" if settings.public_event_source_url else "public-json"
    return PublicSourcePayload(
        sourceKey=DEFAULT_EVENT_SOURCE_KEY,
        provider=provider,
        name="JamIssue Public Event Feed",
        sourceUrl=source_url,
    )


def build_source_url(settings: Settings) -> str:
    """
    설정된 행사 API 원본 URL(source_url)에 인증용 서비스 키(serviceKey) 및 응답 포맷(json) 파라미터를 추가하여 완전한 호출 URL을 생성합니다.
    """

    source_url = settings.public_event_source_url.strip()
    if not source_url:
        return ""

    parsed = urlparse(source_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if settings.public_event_service_key and "serviceKey" not in query:
        query["serviceKey"] = settings.public_event_service_key
    if "resultType" not in query:
        query["resultType"] = "json"
    if "type" not in query:
        query["type"] = "json"
    rebuilt = parsed._replace(query=urlencode(query, doseq=True))
    return urlunparse(rebuilt)


def read_public_event_payload(settings: Settings) -> dict:
    """
    행사 API URL로 HTTP 요청을 보내거나 지정된 로컬 JSON 파일을 읽어와 파싱된 원본 딕셔너리를 반환합니다.
    통신 실패 시 빈 리스트({"items": []})를 기본값으로 반환합니다.
    """

    request_url = build_source_url(settings)
    if request_url:
        request = Request(request_url, headers={"Accept": "application/json"})
        try:
            with urlopen(request, timeout=12) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            pass

    if settings.public_event_file_path.exists():
        return json.loads(settings.public_event_file_path.read_text(encoding="utf-8"))

    return {"items": []}
