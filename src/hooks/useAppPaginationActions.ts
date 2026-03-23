import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getMyCommentsPage, getReviewFeedPage } from '../api/client';
import type { MyPageResponse, Review, SessionUser } from '../types';

type SetState<T> = Dispatch<SetStateAction<T>>;

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
  function reportBackgroundError(error: unknown) {
    console.error(error);
  }

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
