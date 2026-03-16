from __future__ import annotations

import json
import secrets
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from fastapi import HTTPException, status

from .config import Settings

NAVER_AUTHORIZE_URL = "https://nid.naver.com/oauth2.0/authorize"
NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token"
NAVER_PROFILE_URL = "https://openapi.naver.com/v1/nid/me"


@dataclass
class NaverProfile:
    id: str
    nickname: str | None
    email: str | None
    name: str | None
    profile_image: str | None


def build_redirect_url(base_url: str, **params: str) -> str:
    parts = urlsplit(base_url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update({key: value for key, value in params.items() if value})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def generate_oauth_state() -> str:
    return secrets.token_urlsafe(24)


def ensure_naver_login_config(settings: Settings) -> None:
    if not settings.naver_login_client_id or not settings.naver_login_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="네이버 로그인 환경 변수가 비어 있어요.",
        )


def build_naver_login_url(settings: Settings, state: str) -> str:
    ensure_naver_login_config(settings)
    params = {
        "response_type": "code",
        "client_id": settings.naver_login_client_id,
        "redirect_uri": settings.naver_login_callback_url,
        "state": state,
    }
    return f"{NAVER_AUTHORIZE_URL}?{urlencode(params)}"


def exchange_code_for_token(settings: Settings, code: str, state: str) -> dict:
    ensure_naver_login_config(settings)
    params = {
        "grant_type": "authorization_code",
        "client_id": settings.naver_login_client_id,
        "client_secret": settings.naver_login_client_secret,
        "code": code,
        "state": state,
    }
    request = Request(f"{NAVER_TOKEN_URL}?{urlencode(params)}", headers={"Accept": "application/json"})
    payload = _load_json(request, "네이버 토큰 교환에 실패했어요.")

    if payload.get("error"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=payload.get("error_description") or "네이버 토큰 교환에 실패했어요.",
        )

    if not payload.get("access_token"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="네이버 access token 을 받지 못했어요.",
        )

    return payload


def fetch_naver_profile(access_token: str) -> NaverProfile:
    request = Request(
        NAVER_PROFILE_URL,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
        },
    )
    payload = _load_json(request, "네이버 사용자 정보를 가져오지 못했어요.")

    if payload.get("resultcode") != "00" or "response" not in payload:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=payload.get("message") or "네이버 사용자 정보를 가져오지 못했어요.",
        )

    response = payload["response"]
    return NaverProfile(
        id=response["id"],
        nickname=response.get("nickname"),
        email=response.get("email"),
        name=response.get("name"),
        profile_image=response.get("profile_image"),
    )


def _load_json(request: Request, default_detail: str) -> dict:
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = default_detail
        try:
            payload = json.loads(error.read().decode("utf-8"))
            detail = payload.get("error_description") or payload.get("message") or detail
        except Exception:
            detail = detail
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from error
    except URLError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=default_detail) from error
