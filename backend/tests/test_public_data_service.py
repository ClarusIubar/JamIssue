from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.db import Base
from app.db_models import Course, MapPlace, PublicDataSource, PublicPlace, PublicPlaceMapLink
from app.public_data import import_public_bundle


def build_session(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(database_url, future=True, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    return session_factory()


def build_settings() -> Settings:
    return Settings(
        database_url="sqlite:///ignored.db",
        public_data_path=str(Path(__file__).resolve().parents[1] / "data/public_bundle.json"),
    )


def test_public_import_creates_source_places_links_and_courses(tmp_path: Path):
    session = build_session(tmp_path)
    settings = build_settings()

    result = import_public_bundle(session, settings)

    assert result.imported_places == 6
    assert result.imported_courses == 4

    source = session.scalars(select(PublicDataSource)).one()
    public_places = session.scalars(select(PublicPlace)).all()
    links = session.scalars(select(PublicPlaceMapLink)).all()
    map_places = session.scalars(select(MapPlace)).all()
    courses = session.scalars(select(Course)).all()

    assert source.source_key == "jamissue-public-bundle"
    assert len(public_places) == 6
    assert len(links) == 6
    assert len(map_places) == 6
    assert len(courses) == 4
    assert all(place.sync_status == "linked" for place in public_places)
    assert all(link.match_method == "slug" for link in links)


def test_public_import_is_idempotent_for_source_and_links(tmp_path: Path):
    session = build_session(tmp_path)
    settings = build_settings()

    first = import_public_bundle(session, settings)
    second = import_public_bundle(session, settings)

    source_count = len(session.scalars(select(PublicDataSource)).all())
    public_place_count = len(session.scalars(select(PublicPlace)).all())
    link_count = len(session.scalars(select(PublicPlaceMapLink)).all())
    map_place_count = len(session.scalars(select(MapPlace)).all())

    assert first.imported_places == 6
    assert second.imported_places == 0
    assert source_count == 1
    assert public_place_count == 6
    assert link_count == 6
    assert map_place_count == 6


def test_public_import_keeps_manual_override_values(tmp_path: Path):
    session = build_session(tmp_path)
    settings = build_settings()

    import_public_bundle(session, settings)

    place = session.scalars(select(MapPlace).where(MapPlace.slug == "hanbat-forest")).one()
    original_name = place.name
    place.latitude = 36.9999
    place.longitude = 127.9999
    place.name = "수동보정 장소"
    place.is_manual_override = True
    session.commit()

    import_public_bundle(session, settings)

    refreshed = session.scalars(select(MapPlace).where(MapPlace.slug == "hanbat-forest")).one()
    assert refreshed.name == "수동보정 장소"
    assert refreshed.latitude == 36.9999
    assert refreshed.longitude == 127.9999
    assert refreshed.is_manual_override is True
    assert refreshed.name != original_name
