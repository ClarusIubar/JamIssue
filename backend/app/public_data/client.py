"""Load a public tourism bundle from a URL or local JSON file."""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ..config import Settings
from .schemas import PublicDataBundle, PublicSourcePayload


DEFAULT_SOURCE_KEY = "jamissue-public-bundle"


def default_source_payload(settings: Settings) -> PublicSourcePayload:
    """Build default source metadata from current settings."""

    source_url = settings.public_data_source_url or str(settings.public_data_file_path)
    provider = "public-api" if settings.public_data_source_url else "public-json"
    return PublicSourcePayload(
        sourceKey=DEFAULT_SOURCE_KEY,
        provider=provider,
        name="JamIssue Public Tourism Feed",
        sourceUrl=source_url,
    )


def read_public_payload(settings: Settings) -> dict:
    """Read raw JSON from a configured URL or local file."""

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
    """Validate raw JSON into the shared public-data bundle schema."""

    raw_payload = read_public_payload(settings)
    bundle = PublicDataBundle.model_validate(raw_payload)
    if not bundle.source:
        bundle.source = default_source_payload(settings)
    elif not bundle.source.source_url:
        bundle.source.source_url = settings.public_data_source_url or str(settings.public_data_file_path)
    return bundle
