"""JamIssue 백엔드 전역 설정입니다."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url


class Settings(BaseSettings):
    """FastAPI 서버에서 사용하는 환경 설정 집합입니다."""

    env: str = "development"
    host: str = "127.0.0.1"
    port: int = 8001
    cors_origins: str = "http://localhost:8000,http://127.0.0.1:8000"
    frontend_url: str = "http://localhost:8000"
    session_secret: str = "jamissue-local-session-secret"
    session_https: bool = False
    jwt_secret: str = "jamissue-local-jwt-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_token_minutes: int = 60 * 24 * 14
    admin_user_ids: str = ""
    database_url: str = "mysql+pymysql://jamissue:jamissue@127.0.0.1:3306/jamissue?charset=utf8mb4"
    seed_demo_data: bool = False
    cleanup_legacy_demo_data: bool = True
    auto_import_public_data: bool = True
    public_data_path: str = "data/public_bundle.json"
    public_data_source_url: str = ""
    public_event_path: str = "data/public_events.json"
    public_event_source_url: str = ""
    public_event_service_key: str = ""
    public_event_city_keyword: str = "대전"
    public_event_refresh_minutes: int = 360
    public_event_limit: int = 6
    storage_backend: Literal["local", "supabase"] = "local"
    upload_dir: str = "storage/uploads"
    upload_base_url: str = "/uploads"
    max_upload_size_bytes: int = 5 * 1024 * 1024
    stamp_unlock_radius_meters: int = 120
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "review-images"
    supabase_storage_public_base_url: str = ""

    naver_login_client_id: str = ""
    naver_login_client_secret: str = ""
    naver_login_callback_url: str = "http://localhost:8000/api/auth/naver/callback"



    kakao_login_client_id: str = ""
    kakao_login_client_secret: str = ""
    kakao_login_callback_url: str = "http://localhost:8000/api/auth/kakao/callback"



    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="APP_",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def backend_dir(self) -> Path:
        """백엔드 루트 디렉터리를 반환합니다."""

        return Path(__file__).resolve().parents[1]

    @property
    def repo_dir(self) -> Path:
        """저장소 루트 디렉터리를 반환합니다."""

        return self.backend_dir.parent

    @property
    def cors_origin_list(self) -> list[str]:
        """CORS 허용 origin 목록을 정리합니다."""

        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def admin_user_id_set(self) -> set[str]:
        """관리자 권한을 가진 사용자 ID 집합입니다."""

        return {user_id.strip() for user_id in self.admin_user_ids.split(",") if user_id.strip()}

    @property
    def upload_path(self) -> Path:
        """업로드 저장 경로를 절대경로로 돌려줍니다."""

        raw_path = Path(self.upload_dir)
        return raw_path if raw_path.is_absolute() else (self.backend_dir / raw_path).resolve()

    @property
    def storage_target_label(self) -> str:
        """헬스 체크에 노출할 저장소 식별 문자열입니다."""

        if self.storage_backend == "supabase":
            return f"supabase://{self.supabase_storage_bucket}"
        return str(self.upload_path)

    @property
    def public_data_file_path(self) -> Path:
        """공공 장소 번들 파일 경로를 절대경로로 돌려줍니다."""

        raw_path = Path(self.public_data_path)
        return raw_path if raw_path.is_absolute() else (self.backend_dir / raw_path).resolve()

    @property
    def public_event_file_path(self) -> Path:
        """공공 행사 번들 파일 경로를 절대경로로 돌려줍니다."""

        raw_path = Path(self.public_event_path)
        return raw_path if raw_path.is_absolute() else (self.backend_dir / raw_path).resolve()

    @property
    def normalized_database_url(self) -> str:
        """SQLAlchemy 드라이버 접두사를 포함한 DB URL을 반환합니다."""

        raw_url = self.database_url.strip()
        lowered = raw_url.lower()
        if lowered.startswith("postgres://"):
            return f"postgresql+psycopg://{raw_url[len('postgres://') :]}"
        if lowered.startswith("postgresql://"):
            return f"postgresql+psycopg://{raw_url[len('postgresql://') :]}"
        if lowered.startswith("mysql://"):
            return f"mysql+pymysql://{raw_url[len('mysql://') :]}"
        return raw_url

    @property
    def database_url_object(self) -> URL | None:
        """정규화된 DB URL을 SQLAlchemy URL 객체로 파싱합니다."""

        try:
            return make_url(self.normalized_database_url)
        except Exception:
            return None

    @property
    def database_host(self) -> str:
        """DB 호스트 이름을 반환합니다."""

        url = self.database_url_object
        return url.host or "" if url else ""

    @property
    def is_sqlite_database(self) -> bool:
        """SQLite 사용 여부를 반환합니다."""

        return self.normalized_database_url.lower().startswith("sqlite")

    @property
    def is_postgres_database(self) -> bool:
        """PostgreSQL 계열 사용 여부를 반환합니다."""

        return self.normalized_database_url.lower().startswith("postgresql")

    @property
    def is_mysql_database(self) -> bool:
        """MySQL 계열 사용 여부를 반환합니다."""

        return self.normalized_database_url.lower().startswith("mysql")

    @property
    def is_supabase_database(self) -> bool:
        """현재 DB 호스트가 Supabase인지 판단합니다."""

        host = self.database_host.lower()
        return "supabase.co" in host or "pooler.supabase.com" in host

    @property
    def uses_supabase_pooler(self) -> bool:
        """Supabase 트랜잭션 풀러 주소 사용 여부를 반환합니다."""

        host = self.database_host.lower()
        url = self.database_url_object
        return host.endswith("pooler.supabase.com") or (url.port == 6543 if url else False)

    @property
    def prefer_sqlalchemy_null_pool(self) -> bool:
        """서버리스/풀러 환경에서 NullPool 사용 여부를 반환합니다."""

        return self.uses_supabase_pooler or (self.env == "worker" and self.is_postgres_database)

    @property
    def database_connect_args(self) -> dict[str, object]:
        """DB 드라이버별 connect_args 기본값입니다."""

        if self.is_sqlite_database:
            return {"check_same_thread": False}
        return {}

    @property
    def database_provider(self) -> str:
        """현재 DB 연결 문자열 기준 공급자를 식별합니다."""

        if self.is_supabase_database:
            return "supabase-postgres"
        if self.is_postgres_database:
            return "postgresql"
        if self.is_mysql_database:
            return "mysql"
        if self.is_sqlite_database:
            return "sqlite"
        return "unknown"

    @property
    def database_display_url(self) -> str:
        """헬스 체크에 노출할 비밀번호 마스킹 DB URL입니다."""

        url = self.database_url_object
        if not url:
            return self.database_provider
        if self.is_sqlite_database:
            return self.normalized_database_url
        return url.render_as_string(hide_password=True)

    @property
    def storage_provider(self) -> str:
        """현재 업로드 저장소 공급자를 식별합니다."""

        return self.storage_backend

    @property
    def supabase_configured(self) -> bool:
        """Supabase URL과 인증키가 준비되어 있는지 확인합니다."""

        return bool(self.supabase_url and (self.supabase_service_role_key or self.supabase_anon_key))

    def is_admin(self, user_id: str | None) -> bool:
        """관리자 사용자 여부를 확인합니다."""

        if not user_id:
            return False
        return user_id in self.admin_user_id_set

    def provider_enabled(self, provider: str) -> bool:
        """소셜 로그인 제공자 설정 여부를 확인합니다."""

        mapping = {
            "naver": bool(self.naver_login_client_id and self.naver_login_client_secret),
            "kakao": bool(self.kakao_login_client_id and self.kakao_login_client_secret),
        }
        return mapping.get(provider, False)

    @property
    def access_token_expires_delta(self):
        from datetime import timedelta
        return timedelta(minutes=self.jwt_access_token_minutes)

    @property
    def access_token_max_age_seconds(self) -> int:
        return int(self.access_token_expires_delta.total_seconds())

    @property
    def auth_cookie_secure(self) -> bool:
        lowered = self.env.strip().lower()
        if lowered in {"development", "dev", "local", "test"}:
            return False
        return bool(self.session_https or lowered in {"production", "prod", "staging"})


@lru_cache
def get_settings() -> Settings:
    """환경 설정 객체를 캐싱해서 반환합니다."""

    return Settings()


