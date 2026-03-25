"""Storage adapters and review image upload validation."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import uuid4

from .config import Settings


class UploadValidationError(ValueError):
    """업로드 검증 실패 시 발생하는 기본 예외 클래스입니다."""


class InvalidFileTypeError(UploadValidationError):
    """허용되지 않은 파일 형식(예: 이미지가 아닌 파일)일 경우 발생합니다."""
    pass


class FileTooLargeError(UploadValidationError):
    """업로드된 파일의 크기가 제한(max_upload_size_bytes)을 초과했을 때 발생합니다."""
    pass


class StorageConfigurationError(ValueError):
    """스토리지 설정(예: Supabase 인증키 누락 등)이 잘못되었을 때 발생합니다."""
    pass


class StorageUploadError(ValueError):
    """실제 파일 업로드 과정 중(네트워크 문제 등)에 발생한 오류를 나타냅니다."""
    pass


@dataclass(slots=True)
class StoredFile:
    """
    업로드가 완료된 파일의 메타데이터를 담는 모델입니다.
    """
    url: str
    file_name: str
    content_type: str


class ImageValidator:
    """
    업로드된 파일이 유효한 이미지인지 검증하는 클래스입니다.

    의존성:
    - config.py (Settings): 최대 업로드 허용 크기 등 설정 참고.
    """
    def __init__(self, settings: Settings):
        self.settings = settings

    def validate(self, *, content_type: str, raw_bytes: bytes) -> None:
        """
        파일의 내용 타입(content_type)과 크기(raw_bytes)를 검증합니다.
        문제가 있을 경우 InvalidFileTypeError 또는 FileTooLargeError를 발생시킵니다.
        """
        if not content_type.startswith("image/"):
            raise InvalidFileTypeError("이미지 파일만 업로드할 수 있어요.")
        if len(raw_bytes) > self.settings.max_upload_size_bytes:
            raise FileTooLargeError("이미지는 5MB 이하로 올려 주세요.")


class LocalStorageAdapter:
    """
    로컬 파일 시스템에 파일을 저장하는 어댑터 클래스입니다.
    테스트 및 개발 환경에서 주로 사용됩니다.
    """
    def __init__(self, settings: Settings):
        self.settings = settings
        self.settings.upload_path.mkdir(parents=True, exist_ok=True)

    def save_review_image(self, *, owner_id: str, file_name: str, content_type: str, raw_bytes: bytes) -> StoredFile:
        """로컬 경로(upload_path)에 리뷰 이미지를 저장하고 StoredFile 모델을 반환합니다."""
        target_path = self.settings.upload_path / file_name
        target_path.write_bytes(raw_bytes)
        return StoredFile(
            url=f"{self.settings.upload_base_url}/{file_name}",
            file_name=file_name,
            content_type=content_type,
        )


class SupabaseStorageAdapter:
    """
    Supabase Storage를 사용하여 파일을 저장하는 어댑터 클래스입니다.
    운영 및 프로덕션 환경에서 주로 사용됩니다.

    의존성:
    - config.py (Settings): Supabase 연동에 필요한 URL 및 키 정보.
    """
    def __init__(self, settings: Settings):
        self.settings = settings
        if not settings.supabase_configured:
            raise StorageConfigurationError("Supabase Storage를 쓰려면 APP_SUPABASE_URL과 인증키가 필요해요.")

    @property
    def auth_token(self) -> str:
        """Supabase Storage 요청 시 필요한 인증 토큰을 반환합니다."""
        token = self.settings.supabase_service_role_key or self.settings.supabase_anon_key
        if not token:
            raise StorageConfigurationError("Supabase 인증키가 비어 있어요.")
        return token

    def build_object_path(self, owner_id: str, file_name: str) -> str:
        """
        저장소 내 객체 경로(object_path)를 생성합니다.
        (예: `reviews/{owner_id}/{file_name}`)
        """
        safe_owner = owner_id.replace(":", "_")
        return f"reviews/{safe_owner}/{file_name}"

    def build_public_url(self, object_path: str) -> str:
        """생성된 객체 경로를 기반으로 외부에 노출될 Public URL을 생성합니다."""
        if self.settings.supabase_storage_public_base_url:
            base_url = self.settings.supabase_storage_public_base_url.rstrip("/")
            return f"{base_url}/{quote(object_path)}"
        return (
            f"{self.settings.supabase_url.rstrip('/')}"
            f"/storage/v1/object/public/{self.settings.supabase_storage_bucket}/{quote(object_path)}"
        )

    def save_review_image(self, *, owner_id: str, file_name: str, content_type: str, raw_bytes: bytes) -> StoredFile:
        """
        Supabase Storage REST API를 호출하여 리뷰 이미지를 업로드합니다.
        성공 시 생성된 Public URL을 포함한 StoredFile을 반환합니다.
        """
        object_path = self.build_object_path(owner_id, file_name)
        upload_url = (
            f"{self.settings.supabase_url.rstrip('/')}"
            f"/storage/v1/object/{self.settings.supabase_storage_bucket}/{quote(object_path)}"
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
            raise StorageUploadError(f"Supabase Storage 업로드에 실패했어요. ({error.code}) {detail}".strip()) from error
        except URLError as error:
            raise StorageUploadError("Supabase Storage에 연결하지 못했어요.") from error

        return StoredFile(
            url=self.build_public_url(object_path),
            file_name=file_name,
            content_type=content_type,
        )


class ReviewImageUploadService:
    """
    리뷰 이미지 업로드를 담당하는 핵심 서비스 클래스입니다.
    검증(Validator)과 저장(Storage) 책임을 조합하여 처리합니다.
    """
    def __init__(self, settings: Settings):
        self.settings = settings
        self.validator = ImageValidator(settings)
        self.storage = get_storage_adapter(settings)

    @staticmethod
    def build_review_file_name(owner_id: str, original_file_name: str | None) -> str:
        """
        업로드될 파일의 고유한 이름을 생성합니다. (충돌 방지 및 보안 목적)
        """
        extension = Path(original_file_name or "upload.jpg").suffix.lower() or ".jpg"
        return f"{owner_id.replace(':', '_')}-{uuid4().hex}{extension}"

    def save_review_image(self, *, owner_id: str, original_file_name: str | None, content_type: str | None, raw_bytes: bytes) -> StoredFile:
        """
        이미지를 검증하고 적합한 스토리지에 저장합니다.

        파라미터:
        - owner_id: 파일을 업로드하는 사용자의 식별자
        - original_file_name: 업로드된 파일의 원래 이름
        - content_type: 파일 내용의 MIME 타입 (ex. 'image/png')
        - raw_bytes: 파일 내용의 바이트 데이터
        """
        normalized_content_type = content_type or "application/octet-stream"
        self.validator.validate(content_type=normalized_content_type, raw_bytes=raw_bytes)
        file_name = self.build_review_file_name(owner_id, original_file_name)
        return self.storage.save_review_image(
            owner_id=owner_id,
            file_name=file_name,
            content_type=normalized_content_type,
            raw_bytes=raw_bytes,
        )


def get_storage_adapter(settings: Settings):
    """환경 설정에 따라 적절한 스토리지 어댑터(Local 또는 Supabase)를 생성하여 반환합니다."""
    if settings.storage_backend == "supabase":
        return SupabaseStorageAdapter(settings)
    return LocalStorageAdapter(settings)


def get_review_image_upload_service(settings: Settings) -> ReviewImageUploadService:
    """
    ReviewImageUploadService의 인스턴스를 생성하여 반환합니다.
    FastAPI 의존성 주입 등에 사용될 수 있습니다.
    """
    return ReviewImageUploadService(settings)
