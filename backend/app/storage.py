"""로컬 파일 시스템과 Supabase Storage를 바꿔 끼울 수 있는 업로드 어댑터입니다."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from .config import Settings


@dataclass(slots=True)
class StoredFile:
    """업로드 결과로 외부에 노출할 파일 정보입니다."""

    url: str
    file_name: str
    content_type: str


class LocalStorageAdapter:
    """기존 로컬 업로드 경로에 파일을 저장합니다."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.settings.upload_path.mkdir(parents=True, exist_ok=True)

    def save_review_image(self, *, owner_id: str, file_name: str, content_type: str, raw_bytes: bytes) -> StoredFile:
        target_path = self.settings.upload_path / file_name
        target_path.write_bytes(raw_bytes)
        return StoredFile(
            url=f"{self.settings.upload_base_url}/{file_name}",
            file_name=file_name,
            content_type=content_type,
        )


class SupabaseStorageAdapter:
    """Supabase Storage 버킷에 후기 이미지를 업로드합니다."""

    def __init__(self, settings: Settings):
        self.settings = settings
        if not settings.supabase_configured:
            raise ValueError("Supabase Storage를 쓰려면 APP_SUPABASE_URL 과 인증키가 필요해요.")

    @property
    def auth_token(self) -> str:
        token = self.settings.supabase_service_role_key or self.settings.supabase_anon_key
        if not token:
            raise ValueError("Supabase 인증키가 비어 있어요.")
        return token

    def build_object_path(self, owner_id: str, file_name: str) -> str:
        safe_owner = owner_id.replace(":", "_")
        return f"reviews/{safe_owner}/{file_name}"

    def build_public_url(self, object_path: str) -> str:
        if self.settings.supabase_storage_public_base_url:
            base_url = self.settings.supabase_storage_public_base_url.rstrip("/")
            return f"{base_url}/{quote(object_path)}"

        return (
            f"{self.settings.supabase_url.rstrip('/')}/storage/v1/object/public/"
            f"{self.settings.supabase_storage_bucket}/{quote(object_path)}"
        )

    def save_review_image(self, *, owner_id: str, file_name: str, content_type: str, raw_bytes: bytes) -> StoredFile:
        object_path = self.build_object_path(owner_id, file_name)
        upload_url = (
            f"{self.settings.supabase_url.rstrip('/')}/storage/v1/object/"
            f"{self.settings.supabase_storage_bucket}/{quote(object_path)}"
        )
        request = Request(
            upload_url,
            data=raw_bytes,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.auth_token}",
                "apikey": self.auth_token,
                "Content-Type": content_type,
                "x-upsert": "false",
            },
        )

        try:
            with urlopen(request) as response:
                response.read()
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="ignore")
            raise ValueError(f"Supabase Storage 업로드에 실패했어요. ({error.code}) {detail}".strip()) from error
        except URLError as error:
            raise ValueError("Supabase Storage에 연결하지 못했어요.") from error

        return StoredFile(
            url=self.build_public_url(object_path),
            file_name=file_name,
            content_type=content_type,
        )


def get_storage_adapter(settings: Settings):
    """환경 설정에 맞는 스토리지 어댑터를 반환합니다."""

    if settings.storage_backend == "supabase":
        return SupabaseStorageAdapter(settings)
    return LocalStorageAdapter(settings)
