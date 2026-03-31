from datetime import timedelta
from pathlib import Path

from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.db import Base
from app.db_models import Feed, FeedLike, TravelSession, User, UserComment, UserIdentity, UserRoute, UserStamp
from app.models import CommentCreate, ProfileUpdateRequest, ReviewCreate, UserRouteCreate
from app.repository import to_seoul_date, toggle_stamp as legacy_toggle_stamp
from app.repository_normalized import (
    create_comment,
    create_review,
    delete_account,
    delete_comment,
    delete_review,
    get_my_page,
    import_public_bundle,
    link_social_identity,
    list_reviews,
    toggle_review_like,
    toggle_stamp,
    update_user_profile,
    upsert_social_user,
    utcnow_naive,
)
from app.user_routes_normalized import create_user_route


def build_session(tmp_path: Path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(database_url, future=True, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    return session_factory()


def load_seed_data(session):
    settings = Settings(database_url="sqlite:///ignored.db", public_data_path=str(Path(__file__).resolve().parents[1] / "data/public_bundle.json"))
    import_public_bundle(session, settings)


def claim_stamp_for(session, user_id: str, place_id: str):
    return toggle_stamp(session, user_id, place_id, 36.3671 if place_id == 'hanbat-forest' else 36.3765, 127.3886 if place_id == 'hanbat-forest' else 127.3868, 120)


def stamp_id_for_place(stamp_state, place_id: str) -> str:
    return next(log.id for log in stamp_state.logs if log.place_id == place_id)


def test_review_comment_and_my_page_flow(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-1', 'hanbat-forest')
    review = create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='꽃길이 진짜 예뻤어요.', mood='설렘', imageUrl='/uploads/demo.jpg'),
        'user-1',
        '민서',
    )
    comments = create_comment(
        session,
        review.id,
        CommentCreate(body='저도 가보고 싶어요.', parentId=None),
        'user-2',
        '가은',
    )
    my_page = get_my_page(session, 'user-1', False)

    assert review.image_url == '/uploads/demo.jpg'
    assert review.visit_number == 1
    assert comments[0].body == '저도 가보고 싶어요.'
    assert my_page.stats.review_count == 1
    assert my_page.stats.unique_place_count == 1
    assert my_page.stamp_logs[0].place_id == 'hanbat-forest'


def test_list_reviews_omits_comment_tree_by_default(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='댓글 트리 제외 테스트', mood='설렘', imageUrl=None),
        'user-owner',
        '소희',
    )
    create_comment(session, review.id, CommentCreate(body='루트 댓글', parentId=None), 'user-commenter', '민서')

    reviews = list_reviews(session, current_user_id='user-owner')

    assert reviews[0].comment_count == 1
    assert reviews[0].comments == []


def test_list_reviews_matches_visible_comment_count_after_soft_delete(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='soft delete count test', mood='설렘', imageUrl=None),
        'user-owner',
        '소희',
    )
    create_comment(session, review.id, CommentCreate(body='곧 지워질 댓글', parentId=None), 'user-owner', '소희')
    comment = session.scalars(select(UserComment).where(UserComment.feed_id == int(review.id))).one()
    delete_comment(session, review.id, str(comment.comment_id), 'user-owner')

    reviews = list_reviews(session, current_user_id='user-owner')

    assert reviews[0].comment_count == 0
    assert reviews[0].comments == []


def test_list_reviews_counts_deleted_parent_when_live_reply_keeps_thread_visible(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='visible deleted parent count test', mood='설렘', imageUrl=None),
        'user-owner',
        '소희',
    )
    create_comment(session, review.id, CommentCreate(body='부모 댓글', parentId=None), 'user-parent', '민서')
    parent = session.scalars(select(UserComment).where(UserComment.body == '부모 댓글')).one()
    create_comment(session, review.id, CommentCreate(body='살아 있는 답글', parentId=str(parent.comment_id)), 'user-child', '가은')
    delete_comment(session, review.id, str(parent.comment_id), 'user-parent')

    reviews = list_reviews(session, current_user_id='user-owner')

    assert reviews[0].comment_count == 2
    assert reviews[0].comments == []


def test_review_allows_different_places_on_same_day(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    first_stamp_state = claim_stamp_for(session, 'user-1', 'hanbat-forest')
    create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(first_stamp_state, 'hanbat-forest'), body='한밭 숲 방문했어요.', mood='설렘', imageUrl=None),
        'user-1',
        '민서',
    )

    second_stamp_state = claim_stamp_for(session, 'user-1', 'expo-bridge')

    # 같은 날이더라도 다른 장소라면 피드 작성이 허용되어야 함
    blocked = False
    try:
        create_review(
            session,
            ReviewCreate(placeId='expo-bridge', stampId=stamp_id_for_place(second_stamp_state, 'expo-bridge'), body='엑스포 다리도 왔어요.', mood='친구랑', imageUrl=None),
            'user-1',
            '민서',
        )
    except ValueError:
        blocked = True

    assert blocked is False


def test_review_is_limited_to_one_per_place_per_day(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-1', 'hanbat-forest')
    create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='한밭 숲 첫 번째 피드.', mood='설렘', imageUrl=None),
        'user-1',
        '민서',
    )

    second_stamp_state = claim_stamp_for(session, 'user-1', 'hanbat-forest')

    # 같은 날, 같은 장소에서 다시 피드를 작성하면 차단되어야 함
    blocked = False
    try:
        create_review(
            session,
            ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(second_stamp_state, 'hanbat-forest'), body='한밭 숲 중복 피드.', mood='설렘', imageUrl=None),
            'user-1',
            '민서',
        )
    except ValueError:
        blocked = True

    assert blocked is True


def test_stamp_requires_real_distance_and_same_day_dedup(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    blocked = False
    try:
        toggle_stamp(session, 'user-1', 'hanbat-forest', 37.0, 127.0, 120)
    except PermissionError:
        blocked = True

    first_state = toggle_stamp(session, 'user-1', 'hanbat-forest', 36.3671, 127.3886, 120)
    second_state = toggle_stamp(session, 'user-1', 'hanbat-forest', 36.3671, 127.3886, 120)

    assert blocked is True
    assert 'hanbat-forest' in first_state.collected_place_ids
    assert len(first_state.logs) == 1
    assert len(second_state.logs) == 1


def test_repeat_visit_and_24h_session_split(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    first_state = claim_stamp_for(session, 'user-1', 'hanbat-forest')
    stamp = session.scalars(select(UserStamp).where(UserStamp.user_id == 'user-1')).one()
    session_row = session.get(TravelSession, stamp.travel_session_id)
    old_time = utcnow_naive() - timedelta(hours=25)
    stamp.created_at = old_time
    stamp.stamp_date = old_time.date()
    session_row.started_at = old_time
    session_row.ended_at = old_time
    session_row.last_stamp_at = old_time
    session.commit()

    second_state = claim_stamp_for(session, 'user-1', 'expo-bridge')

    assert first_state.logs[0].visit_number == 1
    assert len(second_state.travel_sessions) == 2
    assert second_state.logs[0].place_id == 'expo-bridge'

    stamp.created_at = utcnow_naive() - timedelta(days=2)
    stamp.stamp_date = (utcnow_naive() - timedelta(days=2)).date()
    session.commit()
    third_state = claim_stamp_for(session, 'user-1', 'hanbat-forest')
    latest_hanbat = next(log for log in third_state.logs if log.place_id == 'hanbat-forest')
    assert latest_hanbat.visit_number == 2
    assert latest_hanbat.visit_label == '2번째 방문'


def test_review_like_flow(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-1', 'hanbat-forest')
    review = create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='산책 동선이 가볍고 좋았어요.', mood='설렘', imageUrl=None),
        'user-1',
        '민서',
    )

    like_state = toggle_review_like(session, review.id, 'user-2', '가은')
    reviews = list_reviews(session, place_id='hanbat-forest', current_user_id='user-2')

    assert like_state.like_count == 1
    assert like_state.liked_by_me is True
    assert reviews[0].like_count == 1
    assert reviews[0].liked_by_me is True


def test_social_identity_does_not_merge_accounts_by_email(tmp_path: Path):
    session = build_session(tmp_path)

    naver_user = upsert_social_user(session, provider='naver', provider_user_id='naver-123', nickname='민서', email='same@example.com', profile_image='https://example.com/naver.png')
    kakao_user = upsert_social_user(session, provider='kakao', provider_user_id='kakao-456', nickname='민서', email='same@example.com', profile_image='https://example.com/kakao.png')

    assert naver_user.user_id != kakao_user.user_id


def test_social_identity_links_two_providers_only_when_explicitly_requested(tmp_path: Path):
    session = build_session(tmp_path)

    naver_user = upsert_social_user(session, provider='naver', provider_user_id='naver-123', nickname='민서', email='same@example.com', profile_image='https://example.com/naver.png')
    linked_user = link_social_identity(session, user_id=naver_user.user_id, provider='kakao', provider_user_id='kakao-456', email='same@example.com', profile_image='https://example.com/kakao.png')
    identities = session.scalars(select(UserIdentity).where(UserIdentity.user_id == naver_user.user_id)).all()

    assert linked_user.user_id == naver_user.user_id
    assert len(identities) == 2
    assert {identity.provider for identity in identities} == {'naver', 'kakao'}


def test_profile_update_marks_completion(tmp_path: Path):
    session = build_session(tmp_path)
    user = upsert_social_user(session, provider='naver', provider_user_id='naver-123', nickname='민서', email='same@example.com')
    updated_user = update_user_profile(session, user.user_id, ProfileUpdateRequest(nickname='새별명'))
    assert updated_user.nickname == '새별명'
    assert updated_user.profile_completed_at is not None


def test_delete_comment_keeps_reply_tree(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(session, ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='현장 메모를 남겨요.', mood='설렘', imageUrl=None), 'user-owner', '소희')
    create_comment(session, review.id, CommentCreate(body='부모 댓글', parentId=None), 'user-parent', '민서')
    parent = session.scalars(select(UserComment).where(UserComment.body == '부모 댓글')).one()
    tree = create_comment(session, review.id, CommentCreate(body='대댓글', parentId=str(parent.comment_id)), 'user-child', '가은')
    updated_tree = delete_comment(session, review.id, str(parent.comment_id), 'user-parent')

    assert tree[0].replies[0].body == '대댓글'
    assert len(updated_tree) == 1
    assert updated_tree[0].body == '삭제된 댓글입니다.'
    assert updated_tree[0].is_deleted is True
    assert len(updated_tree[0].replies) == 1
    assert updated_tree[0].replies[0].body == '대댓글'
    assert updated_tree[0].replies[0].parent_id == updated_tree[0].id


def test_delete_parent_and_reply_hides_entire_thread(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='부모/자식 삭제 테스트', mood='설렘', imageUrl=None),
        'user-owner',
        '소희',
    )
    create_comment(session, review.id, CommentCreate(body='부모 댓글', parentId=None), 'user-parent', '민서')
    parent = session.scalars(select(UserComment).where(UserComment.body == '부모 댓글')).one()
    create_comment(session, review.id, CommentCreate(body='대댓글', parentId=str(parent.comment_id)), 'user-child', '가은')
    reply = session.scalars(select(UserComment).where(UserComment.body == '대댓글')).one()

    delete_comment(session, review.id, str(parent.comment_id), 'user-parent')
    updated_tree = delete_comment(session, review.id, str(reply.comment_id), 'user-child')

    assert updated_tree == []


def test_delete_comment_without_reply_disappears_from_tree(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='단독 댓글 테스트', mood='설렘', imageUrl=None),
        'user-owner',
        '소희',
    )
    create_comment(session, review.id, CommentCreate(body='혼자 있는 댓글', parentId=None), 'user-owner', '소희')
    comment = session.scalars(select(UserComment).where(UserComment.body == '혼자 있는 댓글')).one()

    updated_tree = delete_comment(session, review.id, str(comment.comment_id), 'user-owner')

    assert updated_tree == []


def test_reply_of_reply_is_flattened_to_depth_one(tmp_path: Path):
    """대댓글의 답글은 2단계 깊이를 초과하지 않고 부모 댓글의 자식으로 귀속됩니다."""
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(session, ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='계층 테스트 후기', mood='설렘', imageUrl=None), 'user-owner', '소희')

    # Create root comment (depth 0)
    create_comment(session, review.id, CommentCreate(body='루트 댓글', parentId=None), 'user-a', '민서')
    root = session.scalars(select(UserComment).where(UserComment.body == '루트 댓글')).one()

    # Create depth-1 reply
    create_comment(session, review.id, CommentCreate(body='대댓글', parentId=str(root.comment_id)), 'user-b', '가은')
    reply = session.scalars(select(UserComment).where(UserComment.body == '대댓글')).one()

    # Attempt to create depth-2 reply (should be redirected to root comment as parent)
    tree = create_comment(session, review.id, CommentCreate(body='대댓글의 답글', parentId=str(reply.comment_id)), 'user-c', '지우')

    deep_reply = session.scalars(select(UserComment).where(UserComment.body == '대댓글의 답글')).one()

    # The reply-of-reply must point to the root comment, not the depth-1 reply
    assert deep_reply.parent_id == root.comment_id

    # The tree must have exactly one root with two depth-1 replies (no depth-2 nesting)
    assert len(tree) == 1
    assert len(tree[0].replies) == 2
    assert tree[0].replies[1].body == '대댓글의 답글'
    assert len(tree[0].replies[1].replies) == 0



def test_my_page_includes_my_comments(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='댓글 목록 테스트 후기', mood='설렘', imageUrl=None),
        'user-owner',
        '소희',
    )
    create_comment(session, review.id, CommentCreate(body='루트 댓글', parentId=None), 'user-owner', '소희')
    root = session.scalars(select(UserComment).where(UserComment.body == '루트 댓글')).one()
    create_comment(session, review.id, CommentCreate(body='답글 댓글', parentId=str(root.comment_id)), 'user-owner', '소희')

    my_page = get_my_page(session, 'user-owner', False)

    assert len(my_page.comments) == 2
    assert my_page.comments[0].place_name == '한밭수목원 잼가든'
    assert my_page.comments[0].review_body == '댓글 목록 테스트 후기'


def test_my_page_excludes_deleted_comments(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(
        session,
        ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='삭제 댓글 숨김 테스트', mood='설렘', imageUrl=None),
        'user-owner',
        '소희',
    )
    create_comment(session, review.id, CommentCreate(body='남아있는 댓글', parentId=None), 'user-owner', '소희')
    create_comment(session, review.id, CommentCreate(body='삭제할 댓글', parentId=None), 'user-owner', '소희')
    deleted_comment = session.scalars(select(UserComment).where(UserComment.body == '삭제할 댓글')).one()
    delete_comment(session, review.id, str(deleted_comment.comment_id), 'user-owner')

    my_page = get_my_page(session, 'user-owner', False)

    assert len(my_page.comments) == 1
    assert my_page.comments[0].body == '남아있는 댓글'


def test_review_marks_continuous_trip_only_after_route_publish(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    second_stamp_state = claim_stamp_for(session, 'user-owner', 'expo-bridge')
    review = create_review(
        session,
        ReviewCreate(placeId='expo-bridge', stampId=stamp_id_for_place(second_stamp_state, 'expo-bridge'), body='연속 여행 기록 후보', mood='설렘', imageUrl=None),
        'user-owner',
        '소희',
    )

    before_publish = list_reviews(session, user_id='user-owner', current_user_id='user-owner')
    assert before_publish[0].id == review.id
    assert before_publish[0].has_published_route is False

    travel_session_id = get_my_page(session, 'user-owner', False).travel_sessions[0].id
    create_user_route(
        session,
        UserRouteCreate(
            title='연속 코스',
            description='두 장소를 이어 만든 공개 코스예요.',
            mood='데이트',
            travelSessionId=travel_session_id,
            isPublic=True,
        ),
        'user-owner',
        '소희',
    )

    after_publish = list_reviews(session, user_id='user-owner', current_user_id='user-owner')
    assert after_publish[0].has_published_route is True

def test_delete_review_removes_comments_and_likes(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    stamp_state = claim_stamp_for(session, 'user-owner', 'hanbat-forest')
    review = create_review(session, ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(stamp_state, 'hanbat-forest'), body='지울 후기예요.', mood='설렘', imageUrl=None), 'user-owner', '소희')
    create_comment(session, review.id, CommentCreate(body='댓글 하나', parentId=None), 'user-commenter', '민서')
    toggle_review_like(session, review.id, 'user-liker', '가은')

    delete_review(session, review.id, 'user-owner')

    assert session.scalar(select(func.count()).select_from(Feed).where(Feed.feed_id == int(review.id))) == 0
    assert session.scalar(select(func.count()).select_from(UserComment)) == 0
    assert session.scalar(select(func.count()).select_from(FeedLike)) == 0


def test_delete_account_cascades_user_content_and_detaches_replies(tmp_path: Path):
    session = build_session(tmp_path)
    load_seed_data(session)

    social_user = upsert_social_user(session, provider='naver', provider_user_id='naver-withdraw', nickname='탈퇴회원', email='withdraw@example.com')
    own_stamp_state = claim_stamp_for(session, social_user.user_id, 'hanbat-forest')
    own_review = create_review(session, ReviewCreate(placeId='hanbat-forest', stampId=stamp_id_for_place(own_stamp_state, 'hanbat-forest'), body='탈퇴 전 후기', mood='설렘', imageUrl=None), social_user.user_id, '탈퇴회원')

    other_stamp_state = claim_stamp_for(session, 'user-other', 'expo-bridge')
    another_review = create_review(session, ReviewCreate(placeId='expo-bridge', stampId=stamp_id_for_place(other_stamp_state, 'expo-bridge'), body='남의 후기', mood='친구랑', imageUrl=None), 'user-other', '다른회원')
    create_comment(session, another_review.id, CommentCreate(body='부모 댓글', parentId=None), social_user.user_id, '탈퇴회원')
    parent_comment = session.scalars(select(UserComment).where(UserComment.body == '부모 댓글')).one()
    create_comment(session, another_review.id, CommentCreate(body='남는 대댓글', parentId=str(parent_comment.comment_id)), 'user-reply', '응답회원')

    claim_stamp_for(session, social_user.user_id, 'expo-bridge')
    travel_session_id = get_my_page(session, social_user.user_id, False).travel_sessions[0].id
    create_user_route(session, UserRouteCreate(title='탈퇴 전 경로', description='실제로 찍은 스탬프를 묶은 경로예요.', mood='데이트', travelSessionId=travel_session_id, isPublic=True), social_user.user_id, '탈퇴회원')
    toggle_review_like(session, another_review.id, social_user.user_id, '탈퇴회원')

    delete_account(session, social_user.user_id)

    remaining_reply = session.scalars(select(UserComment).where(UserComment.body == '남는 대댓글')).one()

    assert session.get(User, social_user.user_id) is None
    assert session.scalar(select(func.count()).select_from(UserIdentity).where(UserIdentity.user_id == social_user.user_id)) == 0
    assert session.scalar(select(func.count()).select_from(Feed).where(Feed.user_id == social_user.user_id)) == 0
    assert session.scalar(select(func.count()).select_from(UserStamp).where(UserStamp.user_id == social_user.user_id)) == 0
    assert session.scalar(select(func.count()).select_from(UserRoute).where(UserRoute.user_id == social_user.user_id)) == 0
    assert session.scalar(select(func.count()).select_from(FeedLike).where(FeedLike.user_id == social_user.user_id)) == 0
    assert remaining_reply.parent_id is None
    assert session.scalar(select(func.count()).select_from(UserComment).where(UserComment.user_id == social_user.user_id)) == 0
    assert session.scalar(select(func.count()).select_from(Feed).where(Feed.feed_id == int(own_review.id))) == 0


def test_profile_update_rejects_duplicate_nickname(tmp_path: Path):
    session = build_session(tmp_path)
    first = upsert_social_user(session, provider='naver', provider_user_id='naver-111', nickname='민서', email='a@example.com')
    second = upsert_social_user(session, provider='kakao', provider_user_id='kakao-222', nickname='가은', email='b@example.com')

    error = None
    try:
        update_user_profile(session, second.user_id, ProfileUpdateRequest(nickname=first.nickname))
    except ValueError as exc:
        error = str(exc)

    assert error == '이미 사용 중인 닉네임이에요.'


def test_social_signup_generates_distinct_duplicate_nickname(tmp_path: Path):
    session = build_session(tmp_path)

    first = upsert_social_user(session, provider='naver', provider_user_id='naver-123', nickname='민서', email='same@example.com')
    second = upsert_social_user(session, provider='kakao', provider_user_id='kakao-456', nickname='민서', email='same@example.com')

    assert first.nickname == '민서'
    assert second.nickname != '민서'
    assert second.nickname.startswith('민서')


def test_legacy_stamp_allows_revisit_after_previous_day(tmp_path: Path):
    """Case A: 어제 스탬프를 찍은 사용자가 오늘 같은 장소에서 다시 찍을 때 성공합니다."""
    session = build_session(tmp_path)
    load_seed_data(session)

    # Stamp the place and backdate it to yesterday
    legacy_toggle_stamp(session, 'user-1', 'hanbat-forest', 36.3671, 127.3886, 120)
    stamp = session.scalars(select(UserStamp).where(UserStamp.user_id == 'user-1')).one()
    yesterday = to_seoul_date(utcnow_naive()) - timedelta(days=1)
    stamp.stamp_date = yesterday
    stamp.created_at = utcnow_naive() - timedelta(days=1)
    session.commit()

    # Should succeed today (not blocked by yesterday's stamp)
    state = legacy_toggle_stamp(session, 'user-1', 'hanbat-forest', 36.3671, 127.3886, 120)
    assert 'hanbat-forest' in state.collected_place_ids


def test_legacy_stamp_blocks_same_day_duplicate(tmp_path: Path):
    """Case B: 오늘 이미 찍은 사용자가 같은 장소를 다시 시도할 때 중복 생성이 차단됩니다."""
    session = build_session(tmp_path)
    load_seed_data(session)

    legacy_toggle_stamp(session, 'user-1', 'hanbat-forest', 36.3671, 127.3886, 120)

    blocked = False
    try:
        legacy_toggle_stamp(session, 'user-1', 'hanbat-forest', 36.3671, 127.3886, 120)
    except ValueError as exc:
        blocked = '이미 오늘 스탬프를 획득했습니다.' in str(exc)

    today = to_seoul_date()
    today_stamp_count = session.scalar(
        select(func.count()).select_from(UserStamp).where(
            UserStamp.user_id == 'user-1',
            UserStamp.stamp_date == today,
        )
    )
    assert blocked is True
    assert today_stamp_count == 1
