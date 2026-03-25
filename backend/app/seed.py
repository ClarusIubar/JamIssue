"""앱 시작 시 필요한 최소 데이터 상태를 보정합니다."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings
from .db_models import MapPlace
from .repository_normalized import cleanup_legacy_demo_content, import_public_bundle


def seed_database(db: Session, settings: Settings) -> None:
    """
    앱의 최초 실행 혹은 설정(cleanup_legacy_demo_data, auto_import_public_data)에 따라
    데이터베이스 초기화(Seed) 및 외부 공공 데이터 동기화 작업을 수행합니다.

    의존성:
    - repository_normalized.py: cleanup_legacy_demo_content, import_public_bundle 함수를 사용합니다.
    - config.py (Settings): 초기화 모드 제어 값들을 참고합니다.
    """

    if settings.cleanup_legacy_demo_data:
        cleanup_legacy_demo_content(db)

    has_place = db.scalars(select(MapPlace.position_id).limit(1)).first() is not None
    if settings.auto_import_public_data and not has_place:
        import_public_bundle(db, settings)
