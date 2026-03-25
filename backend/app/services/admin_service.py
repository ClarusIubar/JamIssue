from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import AdminPlaceOut, AdminSummaryResponse, PlaceVisibilityUpdate, PublicImportResponse
from ..repository_normalized import get_admin_summary, import_public_bundle, update_place_visibility


def read_admin_summary_service(db: Session, app_settings: Settings) -> AdminSummaryResponse:
    """
    관리자 패널의 대시보드에서 조회할 전반적인 통계와 운영 지표를 반환합니다.
    """
    return get_admin_summary(db, app_settings)


def patch_admin_place_service(db: Session, place_id: str, payload: PlaceVisibilityUpdate) -> AdminPlaceOut:
    """
    관리자가 지도 장소의 노출 여부(is_active)나 매뉴얼 오버라이드 상태를 변경합니다.
    """
    try:
        return update_place_visibility(
            db,
            place_id,
            is_active=payload.is_active,
            is_manual_override=payload.is_manual_override,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


def import_public_data_service(db: Session, app_settings: Settings) -> PublicImportResponse:
    """
    공공 데이터를 동기화하고 적용된 결과를 반환합니다.
    """
    return import_public_bundle(db, app_settings)
