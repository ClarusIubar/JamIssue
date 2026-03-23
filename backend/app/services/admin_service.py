from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import AdminPlaceOut, AdminSummaryResponse, PlaceVisibilityUpdate, PublicImportResponse
from ..repository_normalized import get_admin_summary, import_public_bundle, update_place_visibility


def read_admin_summary_service(db: Session, app_settings: Settings) -> AdminSummaryResponse:
    return get_admin_summary(db, app_settings)


def patch_admin_place_service(db: Session, place_id: str, payload: PlaceVisibilityUpdate) -> AdminPlaceOut:
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
    return import_public_bundle(db, app_settings)
