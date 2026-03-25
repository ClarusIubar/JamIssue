import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getMyCommentsPage, getReviewFeedPage } from '../api/client';
import type { MyPageResponse, Review, SessionUser } from '../types';

type SetState<T> = Dispatch<SetStateAction<T>>;

/**
 * useAppPaginationActions 훅에서 사용하는 파라미터 인터페이스입니다.
 * 리뷰 목록, 내 댓글 목록의 무한 스크롤 상태(다음 커서, 로딩 여부 등)를 담고 있습니다.
 */
interface UseAppPaginationActionsParams {
  sessionUser: SessionUser | null;
  myPage: MyPageResponse | null;
  feedLoadingMore: boolean;
  feedHasMore: boolean;
  feedNextCursor: string | null;
  setFeedLoadingMore: SetState<boolean>;
  setReviews: SetState<Review[]>;
  setFeedNextCursor: SetState<string | null>;
  setFeedHasMore: SetState<boolean>;
  myCommentsLoadingMore: boolean;
  myCommentsHasMore: boolean;
  myCommentsNextCursor: string | null;
  setMyCommentsLoadingMore: SetState<boolean>;
  setMyCommentsLoadedOnce: SetState<boolean>;
  setMyPage: SetState<MyPageResponse | null>;
  setMyCommentsNextCursor: SetState<string | null>;
  setMyCommentsHasMore: SetState<boolean>;
}

/**
 * 리스트 하단에 도달했을 때 다음 페이지(커서)의 데이터를 불러오는 페이지네이션 액션을 묶어둔 훅입니다.
 */
export function useAppPaginationActions({
  sessionUser,
  myPage,
  feedLoadingMore,
  feedHasMore,
  feedNextCursor,
  setFeedLoadingMore,
  setReviews,
  setFeedNextCursor,
  setFeedHasMore,
  myCommentsLoadingMore,
  myCommentsHasMore,
  myCommentsNextCursor,
  setMyCommentsLoadingMore,
  setMyCommentsLoadedOnce,
  setMyPage,
  setMyCommentsNextCursor,
  setMyCommentsHasMore,
}: UseAppPaginationActionsParams) {
  /**
   * (내부용) 데이터를 불러오다 실패했을 때 에러를 삼키고 콘솔에만 기록하는 로직입니다.
   */
  function reportBackgroundError(error: unknown) {
    console.error(error);
  }

  /**
   * 커뮤니티 피드 탭에서 리뷰 목록의 다음 페이지를 불러와 덧붙입니다.
   */
  async function loadMoreFeedReviews() {
    if (feedLoadingMore || !feedHasMore) {
      return;
    }

    setFeedLoadingMore(true);
    try {
      const page = await getReviewFeedPage({ cursor: feedNextCursor, limit: 10 });
      setReviews((current) => {
        const existingIds = new Set(current.map((review) => review.id));
        const nextItems = page.items.filter((review) => !existingIds.has(review.id));
        return [...current, ...nextItems];
      });
      setFeedNextCursor(page.nextCursor);
      setFeedHasMore(Boolean(page.nextCursor));
    } catch (error) {
      reportBackgroundError(error);
    } finally {
      setFeedLoadingMore(false);
    }
  }

  /**
   * 마이페이지 내 댓글 탭에서 무한 스크롤 조회를 실행합니다.
   * `initial` 플래그가 참이면 처음부터 다시 불러옵니다.
   */
  async function loadMoreMyComments(initial = false) {
    if (!sessionUser || !myPage) {
      return;
    }
    if (myCommentsLoadingMore || (!initial && !myCommentsHasMore)) {
      return;
    }

    setMyCommentsLoadingMore(true);
    setMyCommentsLoadedOnce(true);
    try {
      const page = await getMyCommentsPage({ cursor: initial ? null : myCommentsNextCursor, limit: 10 });
      setMyPage((current) => {
        if (!current) {
          return current;
        }
        const base = initial ? [] : current.comments;
        const existingIds = new Set(base.map((comment) => comment.id));
        const nextItems = page.items.filter((comment) => !existingIds.has(comment.id));
        return {
          ...current,
          comments: [...base, ...nextItems],
        };
      });
      setMyCommentsNextCursor(page.nextCursor);
      setMyCommentsHasMore(Boolean(page.nextCursor));
    } catch (error) {
      reportBackgroundError(error);
    } finally {
      setMyCommentsLoadingMore(false);
    }
  }

  return {
    loadMoreFeedReviews,
    loadMoreMyComments,
  };
}
