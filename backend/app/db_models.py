from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class User(Base):
    __tablename__ = "user"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    nickname: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    provider: Mapped[str] = mapped_column(String(50), default="demo", nullable=False)
    profile_completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    identities: Mapped[list["UserIdentity"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    feeds: Mapped[list["Feed"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    feed_likes: Mapped[list["FeedLike"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    comments: Mapped[list["UserComment"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    stamps: Mapped[list["UserStamp"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    created_routes: Mapped[list["UserRoute"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    route_likes: Mapped[list["UserRouteLike"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    travel_sessions: Mapped[list["TravelSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class UserIdentity(Base):
    __tablename__ = "user_identity"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_user_identity_provider_user"),
        UniqueConstraint("user_id", "provider", name="uq_user_identity_user_provider"),
    )

    identity_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_user_id: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=True)
    profile_image: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="identities")


class MapPlace(Base):
    __tablename__ = "map"

    position_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    district: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    summary: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    vibe_tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    visit_time: Mapped[str] = mapped_column(String(50), nullable=False)
    route_hint: Mapped[str] = mapped_column(String(255), nullable=False)
    stamp_reward: Mapped[str] = mapped_column(String(120), nullable=False)
    hero_label: Mapped[str] = mapped_column(String(60), nullable=False)
    jam_color: Mapped[str] = mapped_column(String(20), nullable=False)
    accent_color: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    feeds: Mapped[list["Feed"]] = relationship(back_populates="place")
    course_places: Mapped[list["CoursePlace"]] = relationship(back_populates="place")
    stamps: Mapped[list["UserStamp"]] = relationship(back_populates="place")
    public_links: Mapped[list["PublicPlaceMapLink"]] = relationship(back_populates="place")
    public_event_links: Mapped[list["PublicEventMapLink"]] = relationship(back_populates="place")
    user_route_places: Mapped[list["UserRoutePlace"]] = relationship(back_populates="place")


class PublicDataSource(Base):
    __tablename__ = "public_data_source"

    source_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    source_url: Mapped[str] = mapped_column(String(255), nullable=True)
    last_imported_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    public_places: Mapped[list["PublicPlace"]] = relationship(back_populates="source")
    public_events: Mapped[list["PublicEvent"]] = relationship(back_populates="source")


class PublicPlace(Base):
    __tablename__ = "public_place"
    __table_args__ = (UniqueConstraint("source_id", "external_id", name="uq_public_place_source_external"),)

    public_place_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("public_data_source.source_id"), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(120), nullable=False)
    map_slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(140), nullable=False)
    district: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=True)
    road_address: Mapped[str] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=True)
    summary: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_url: Mapped[str] = mapped_column(String(255), nullable=True)
    contact: Mapped[str] = mapped_column(String(100), nullable=True)
    source_page_url: Mapped[str] = mapped_column(String(255), nullable=True)
    source_updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    sync_status: Mapped[str] = mapped_column(String(20), nullable=False, default="imported")
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    normalized_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    source: Mapped["PublicDataSource"] = relationship(back_populates="public_places")
    map_links: Mapped[list["PublicPlaceMapLink"]] = relationship(back_populates="public_place")


class PublicPlaceMapLink(Base):
    __tablename__ = "public_place_map_link"
    __table_args__ = (UniqueConstraint("public_place_id", "position_id", name="uq_public_place_map_link"),)

    public_place_map_link_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    public_place_id: Mapped[int] = mapped_column(ForeignKey("public_place.public_place_id"), nullable=False, index=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("map.position_id"), nullable=False, index=True)
    match_method: Mapped[str] = mapped_column(String(30), nullable=False, default="slug")
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    linked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    public_place: Mapped["PublicPlace"] = relationship(back_populates="map_links")
    place: Mapped["MapPlace"] = relationship(back_populates="public_links")


class PublicEvent(Base):
    __tablename__ = "public_event"
    __table_args__ = (UniqueConstraint("source_id", "external_id", name="uq_public_event_source_external"),)

    public_event_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("public_data_source.source_id"), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    venue_name: Mapped[str] = mapped_column(String(140), nullable=True)
    district: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(255), nullable=True)
    road_address: Mapped[str] = mapped_column(String(255), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=True)
    longitude: Mapped[float] = mapped_column(Float, nullable=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    summary: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    image_url: Mapped[str] = mapped_column(String(255), nullable=True)
    contact: Mapped[str] = mapped_column(String(100), nullable=True)
    source_page_url: Mapped[str] = mapped_column(String(255), nullable=True)
    source_updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    sync_status: Mapped[str] = mapped_column(String(20), nullable=False, default="imported")
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    normalized_payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    source: Mapped["PublicDataSource"] = relationship(back_populates="public_events")
    map_links: Mapped[list["PublicEventMapLink"]] = relationship(back_populates="public_event")


class PublicEventMapLink(Base):
    __tablename__ = "public_event_map_link"
    __table_args__ = (UniqueConstraint("public_event_id", "position_id", name="uq_public_event_map_link"),)

    public_event_map_link_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    public_event_id: Mapped[int] = mapped_column(ForeignKey("public_event.public_event_id"), nullable=False, index=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("map.position_id"), nullable=False, index=True)
    match_method: Mapped[str] = mapped_column(String(30), nullable=False, default="name-exact")
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    linked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    public_event: Mapped["PublicEvent"] = relationship(back_populates="map_links")
    place: Mapped["MapPlace"] = relationship(back_populates="public_event_links")


class Feed(Base):
    __tablename__ = "feed"

    feed_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("map.position_id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    stamp_id: Mapped[int] = mapped_column(ForeignKey("user_stamp.stamp_id"), nullable=False, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    mood: Mapped[str] = mapped_column(String(20), nullable=False)
    badge: Mapped[str] = mapped_column(String(50), nullable=False, default="로컬 메모")
    image_url: Mapped[str] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    place: Mapped["MapPlace"] = relationship(back_populates="feeds")
    user: Mapped["User"] = relationship(back_populates="feeds")
    stamp: Mapped["UserStamp"] = relationship(back_populates="feeds")
    likes: Mapped[list["FeedLike"]] = relationship(back_populates="feed", cascade="all, delete-orphan", passive_deletes=True)
    comments: Mapped[list["UserComment"]] = relationship(
        back_populates="feed",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class FeedLike(Base):
    __tablename__ = "feed_like"
    __table_args__ = (UniqueConstraint("feed_id", "user_id", name="uq_feed_like"),)

    feed_like_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feed_id: Mapped[int] = mapped_column(ForeignKey("feed.feed_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    feed: Mapped["Feed"] = relationship(back_populates="likes")
    user: Mapped["User"] = relationship(back_populates="feed_likes")


class UserComment(Base):
    __tablename__ = "user_comment"

    comment_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    feed_id: Mapped[int] = mapped_column(ForeignKey("feed.feed_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("user_comment.comment_id", ondelete="SET NULL"), nullable=True, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    feed: Mapped["Feed"] = relationship(back_populates="comments")
    user: Mapped["User"] = relationship(back_populates="comments")
    parent: Mapped["UserComment"] = relationship(remote_side=[comment_id], back_populates="replies")
    replies: Mapped[list["UserComment"]] = relationship(back_populates="parent", passive_deletes=True)


class Course(Base):
    __tablename__ = "course"

    course_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    mood: Mapped[str] = mapped_column(String(20), nullable=False)
    duration: Mapped[str] = mapped_column(String(40), nullable=False)
    note: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    course_places: Mapped[list["CoursePlace"]] = relationship(back_populates="course")


class CoursePlace(Base):
    __tablename__ = "course_place"
    __table_args__ = (UniqueConstraint("course_id", "position_id", name="uq_course_place"),)

    course_place_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("course.course_id"), nullable=False)
    position_id: Mapped[int] = mapped_column(ForeignKey("map.position_id"), nullable=False)
    stop_order: Mapped[int] = mapped_column(Integer, nullable=False)

    course: Mapped["Course"] = relationship(back_populates="course_places")
    place: Mapped["MapPlace"] = relationship(back_populates="course_places")


class TravelSession(Base):
    __tablename__ = "travel_session"

    travel_session_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_stamp_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    stamp_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="travel_sessions")
    stamp_logs: Mapped[list["UserStamp"]] = relationship(back_populates="travel_session")
    routes: Mapped[list["UserRoute"]] = relationship(back_populates="travel_session")


class UserStamp(Base):
    __tablename__ = "user_stamp"
    __table_args__ = (UniqueConstraint("user_id", "position_id", "stamp_date", name="uq_user_stamp_per_day"),)

    stamp_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("map.position_id"), nullable=False, index=True)
    travel_session_id: Mapped[int | None] = mapped_column(ForeignKey("travel_session.travel_session_id", ondelete="SET NULL"), nullable=True, index=True)
    stamp_date: Mapped[date] = mapped_column(Date, nullable=False)
    visit_ordinal: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="stamps")
    place: Mapped["MapPlace"] = relationship(back_populates="stamps")
    travel_session: Mapped["TravelSession"] = relationship(back_populates="stamp_logs")
    feeds: Mapped[list["Feed"]] = relationship(back_populates="stamp")


class UserRoute(Base):
    __tablename__ = "user_route"

    route_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    travel_session_id: Mapped[int | None] = mapped_column(ForeignKey("travel_session.travel_session_id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    mood: Mapped[str] = mapped_column(String(20), nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_user_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    like_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="created_routes")
    travel_session: Mapped["TravelSession"] = relationship(back_populates="routes")
    route_places: Mapped[list["UserRoutePlace"]] = relationship(back_populates="route", cascade="all, delete-orphan", passive_deletes=True)
    likes: Mapped[list["UserRouteLike"]] = relationship(back_populates="route", cascade="all, delete-orphan", passive_deletes=True)


class UserRoutePlace(Base):
    __tablename__ = "user_route_place"
    __table_args__ = (UniqueConstraint("route_id", "position_id", name="uq_user_route_place"),)

    user_route_place_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("user_route.route_id", ondelete="CASCADE"), nullable=False, index=True)
    position_id: Mapped[int] = mapped_column(ForeignKey("map.position_id"), nullable=False, index=True)
    stop_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    route: Mapped["UserRoute"] = relationship(back_populates="route_places")
    place: Mapped["MapPlace"] = relationship(back_populates="user_route_places")


class UserRouteLike(Base):
    __tablename__ = "user_route_like"
    __table_args__ = (UniqueConstraint("route_id", "user_id", name="uq_user_route_like"),)

    route_like_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("user_route.route_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("user.user_id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    route: Mapped["UserRoute"] = relationship(back_populates="likes")
    user: Mapped["User"] = relationship(back_populates="route_likes")



