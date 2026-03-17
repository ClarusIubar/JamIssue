"""앱 시작 시 필요한 최소 데이터 상태를 보정합니다."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings
from .db_models import MapPlace
from .repository_normalized import cleanup_legacy_demo_content, import_public_bundle


def seed_database(db: Session, settings: Settings) -> None:
    """레거시 데모 데이터를 정리하고 기본 장소 데이터를 채웁니다."""

    if settings.cleanup_legacy_demo_data:
        cleanup_legacy_demo_content(db)

    has_place = db.scalars(select(MapPlace.position_id).limit(1)).first() is not None
    if settings.auto_import_public_data and not has_place:
        import_public_bundle(db, settings)
