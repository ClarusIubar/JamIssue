"""Load a public tourism bundle from a URL or local JSON file."""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..config import Settings
from .schemas import PublicDataBundle, PublicSourcePayload


DEFAULT_SOURCE_KEY = "jamissue-public-bundle"


def default_source_payload(settings: Settings) -> PublicSourcePayload:
    """
    현재 설정(Settings)을 바탕으로 공공데이터 소스의 기본 메타데이터(PublicSourcePayload)를 생성합니다.
    """

    source_url = settings.public_data_source_url or str(settings.public_data_file_path)
    provider = "public-api" if settings.public_data_source_url else "public-json"
    return PublicSourcePayload(
        sourceKey=DEFAULT_SOURCE_KEY,
        provider=provider,
        name="JamIssue Public Tourism Feed",
        sourceUrl=source_url,
    )


def read_public_payload(settings: Settings) -> dict:
    """
    설정된 URL이나 로컬 파일에서 공공데이터 원본 JSON을 읽어와 딕셔너리로 반환합니다.
    URL 호출 실패 시 로컬 파일을 우선 시도합니다.
    """

    if settings.public_data_source_url:
        request = Request(settings.public_data_source_url, headers={"Accept": "application/json"})
        try:
            with urlopen(request, timeout=10) as response:
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            pass

    if settings.public_data_file_path.exists():
        return json.loads(settings.public_data_file_path.read_text(encoding="utf-8"))

    return {"source": None, "places": [], "courses": []}


def load_public_bundle(settings: Settings) -> PublicDataBundle:
    """
    읽어온 원본 JSON 데이터를 Pydantic 스키마(PublicDataBundle)를 통해 검증하고 변환하여 반환합니다.
    소스 메타데이터가 누락된 경우 기본값을 채워넣습니다.
    """

    raw_payload = read_public_payload(settings)
    bundle = PublicDataBundle.model_validate(raw_payload)
    if not bundle.source:
        bundle.source = default_source_payload(settings)
    elif not bundle.source.source_url:
        bundle.source.source_url = settings.public_data_source_url or str(settings.public_data_file_path)
    return bundle
