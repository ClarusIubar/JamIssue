import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { getMyCommentsPage, getReviewFeedPage } from '../api/client';
import { toReviewSummaryList } from '../lib/reviews';
import { useAppRuntimeStore } from '../store/app-runtime-store';
import type { MyPageResponse, Review, SessionUser } from '../types';

type SetState<T> = Dispatch<SetStateAction<T>>;

interface UseAppPagePaginationActionsParams {
  sessionUser: SessionUser | null;
  myPage: MyPageResponse | null;
  setReviews: SetState<Review[]>;
  setMyPage: SetState<MyPageResponse | null>;
  reportBackgroundError: (error: unknown) => void;
}

export function useAppPagePaginationActions({
  sessionUser,
  myPage,
  setReviews,
  setMyPage,
  reportBackgroundError,
}: UseAppPagePaginationActionsParams) {
  const feedNextCursor = useAppRuntimeStore((state) => state.feedNextCursor);
  const feedHasMore = useAppRuntimeStore((state) => state.feedHasMore);
  const feedLoadingMore = useAppRuntimeStore((state) => state.feedLoadingMore);
  const myCommentsNextCursor = useAppRuntimeStore((state) => state.myCommentsNextCursor);
  const myCommentsHasMore = useAppRuntimeStore((state) => state.myCommentsHasMore);
  const myCommentsLoadingMore = useAppRuntimeStore((state) => state.myCommentsLoadingMore);
  const setFeedNextCursor = useAppRuntimeStore((state) => state.setFeedNextCursor);
  const setFeedHasMore = useAppRuntimeStore((state) => state.setFeedHasMore);
  const setFeedLoadingMore = useAppRuntimeStore((state) => state.setFeedLoadingMore);
  const setMyCommentsNextCursor = useAppRuntimeStore((state) => state.setMyCommentsNextCursor);
  const setMyCommentsHasMore = useAppRuntimeStore((state) => state.setMyCommentsHasMore);
  const setMyCommentsLoadingMore = useAppRuntimeStore((state) => state.setMyCommentsLoadingMore);
  const setMyCommentsLoadedOnce = useAppRuntimeStore((state) => state.setMyCommentsLoadedOnce);

  const loadMoreFeedReviews = useCallback(async () => {
    if (feedLoadingMore || !feedHasMore) {
      return;
    }

    setFeedLoadingMore(true);
    try {
      const page = await getReviewFeedPage({ cursor: feedNextCursor, limit: 10 });
      setReviews((current) => {
        const existingIds = new Set(current.map((review) => review.id));
        const nextItems = toReviewSummaryList(page.items).filter((review) => !existingIds.has(review.id));
        return [...current, ...nextItems];
      });
      setFeedNextCursor(page.nextCursor);
      setFeedHasMore(Boolean(page.nextCursor));
    } catch (error) {
      reportBackgroundError(error);
    } finally {
      setFeedLoadingMore(false);
    }
  }, [
    feedHasMore,
    feedLoadingMore,
    feedNextCursor,
    reportBackgroundError,
    setFeedHasMore,
    setFeedLoadingMore,
    setFeedNextCursor,
    setReviews,
  ]);

  const loadMoreMyComments = useCallback(async (initial = false) => {
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
  }, [
    myCommentsHasMore,
    myCommentsLoadingMore,
    myCommentsNextCursor,
    myPage,
    reportBackgroundError,
    sessionUser,
    setMyCommentsHasMore,
    setMyCommentsLoadedOnce,
    setMyCommentsLoadingMore,
    setMyCommentsNextCursor,
    setMyPage,
  ]);

  return {
    loadMoreFeedReviews,
    loadMoreMyComments,
  };
}
