"""Synchronize public tourism data into dedicated source tables and map tables."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import Settings
from ..db_models import Course, CoursePlace, MapPlace, PublicDataSource, PublicPlace, PublicPlaceMapLink
from ..models import PublicImportResponse
from .client import load_public_bundle
from .normalizer import normalize_public_place
from .schemas import PublicDataBundle, PublicSourcePayload


def utc_now() -> datetime:
    """Return a naive UTC timestamp for DB writes."""

    return datetime.now(UTC).replace(tzinfo=None)


def upsert_public_source(db: Session, source_payload: PublicSourcePayload, now: datetime) -> PublicDataSource:
    """Create or update a public source metadata row."""

    source = db.scalars(
        select(PublicDataSource).where(PublicDataSource.source_key == source_payload.source_key)
    ).first()
    if not source:
        source = PublicDataSource(source_key=source_payload.source_key, created_at=now)
        db.add(source)

    source.provider = source_payload.provider
    source.name = source_payload.name
    source.source_url = source_payload.source_url
    source.updated_at = now
    return source


def upsert_map_place(db: Session, map_payload: dict, now: datetime) -> tuple[MapPlace, bool]:
    """Create or update a map place from normalized public data."""

    place = db.scalars(select(MapPlace).where(MapPlace.slug == map_payload["slug"])).first()
    created = False
    if not place:
        place = MapPlace(slug=map_payload["slug"], created_at=now)
        db.add(place)
        created = True

    if not place.is_manual_override:
        place.name = map_payload["name"]
        place.district = map_payload["district"]
        place.category = map_payload["category"]
        place.latitude = map_payload["latitude"]
        place.longitude = map_payload["longitude"]
        place.summary = map_payload["summary"]
        place.description = map_payload["description"]
        place.vibe_tags = map_payload["vibe_tags"]
        place.visit_time = map_payload["visit_time"]
        place.route_hint = map_payload["route_hint"]
        place.stamp_reward = map_payload["stamp_reward"]
        place.hero_label = map_payload["hero_label"]
        place.jam_color = map_payload["jam_color"]
        place.accent_color = map_payload["accent_color"]
    place.is_active = map_payload["is_active"]
    place.updated_at = now
    db.flush()
    return place, created


def upsert_public_place_link(
    db: Session,
    public_place: PublicPlace,
    map_place: MapPlace,
    now: datetime,
) -> None:
    """Link a normalized public place to a JamIssue map place."""

    for existing_link in public_place.map_links:
        existing_link.is_primary = existing_link.position_id == map_place.position_id
        existing_link.updated_at = now

    link = db.scalars(
        select(PublicPlaceMapLink).where(
            PublicPlaceMapLink.public_place_id == public_place.public_place_id,
            PublicPlaceMapLink.position_id == map_place.position_id,
        )
    ).first()
    if not link:
        link = PublicPlaceMapLink(
            public_place_id=public_place.public_place_id,
            position_id=map_place.position_id,
            linked_at=now,
            created_at=now,
        )
        db.add(link)

    link.match_method = "slug"
    link.confidence_score = 1.0
    link.is_primary = True
    link.updated_at = now


def mark_stale_public_places(db: Session, source_id: int, seen_external_ids: set[str], now: datetime) -> None:
    """Mark missing records from the last import as stale."""

    stale_places = db.scalars(select(PublicPlace).where(PublicPlace.source_id == source_id)).all()
    for place in stale_places:
        if place.external_id in seen_external_ids:
            continue
        place.sync_status = "stale"
        place.updated_at = now


def sync_courses(db: Session, bundle: PublicDataBundle) -> int:
    """Sync course definitions using current map-place rows."""

    imported_courses = 0
    place_by_slug = {place.slug: place for place in db.scalars(select(MapPlace)).all()}

    for item in bundle.courses:
        course = db.scalars(select(Course).where(Course.slug == item.slug)).first()
        if not course:
            course = Course(
                slug=item.slug,
                title=item.title,
                mood=item.mood,
                duration=item.duration,
                note=item.note,
                color=item.color,
                display_order=item.display_order,
            )
            db.add(course)
            imported_courses += 1
        else:
            course.title = item.title
            course.mood = item.mood
            course.duration = item.duration
            course.note = item.note
            course.color = item.color
            course.display_order = item.display_order

        db.flush()
        db.execute(delete(CoursePlace).where(CoursePlace.course_id == course.course_id))
        for index, slug in enumerate(item.place_slugs, start=1):
            place = place_by_slug.get(slug)
            if not place:
                continue
            db.add(CoursePlace(course_id=course.course_id, position_id=place.position_id, stop_order=index))

    return imported_courses


def import_public_bundle(db: Session, settings: Settings) -> PublicImportResponse:
    """Import the configured public tourism bundle into source and map tables."""

    bundle = load_public_bundle(settings)
    if not bundle.source:
        raise ValueError("Public source metadata is missing.")

    now = utc_now()
    source = upsert_public_source(db, bundle.source, now)
    db.flush()

    imported_places = 0
    seen_external_ids: set[str] = set()

    for raw_place in bundle.places:
        normalized = normalize_public_place(raw_place)
        public_place = db.scalars(
            select(PublicPlace).where(
                PublicPlace.source_id == source.source_id,
                PublicPlace.external_id == normalized.external_id,
            )
        ).first()
        if not public_place:
            public_place = PublicPlace(
                source_id=source.source_id,
                external_id=normalized.external_id,
                created_at=now,
            )
            db.add(public_place)

        public_place.map_slug = normalized.map_slug
        public_place.display_name = normalized.display_name
        public_place.district = normalized.district
        public_place.category = normalized.category
        public_place.address = normalized.address
        public_place.road_address = normalized.road_address
        public_place.latitude = normalized.latitude
        public_place.longitude = normalized.longitude
        public_place.summary = normalized.summary
        public_place.description = normalized.description
        public_place.image_url = normalized.image_url
        public_place.contact = normalized.contact
        public_place.source_page_url = normalized.source_page_url
        public_place.source_updated_at = normalized.source_updated_at
        public_place.raw_payload = raw_place.model_dump(by_alias=True, exclude_none=True)
        public_place.normalized_payload = normalized.normalized_payload
        public_place.sync_status = "imported"
        public_place.updated_at = now
        db.flush()

        if normalized.map_payload:
            map_place, created = upsert_map_place(db, normalized.map_payload, now)
            if created:
                imported_places += 1
            upsert_public_place_link(db, public_place, map_place, now)
            public_place.sync_status = "linked"

        seen_external_ids.add(normalized.external_id)

    mark_stale_public_places(db, source.source_id, seen_external_ids, now)
    imported_courses = sync_courses(db, bundle)
    source.last_imported_at = now
    source.updated_at = now
    db.commit()

    return PublicImportResponse(importedPlaces=imported_places, importedCourses=imported_courses)
