import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getAdminSummary, getCommunityRoutes, getMySummary, getReviewFeedPage } from '../api/client';
import { toReviewSummaryList } from '../lib/reviews';
import type {
  AdminSummaryResponse,
  CommunityRouteSort,
  Course,
  MyPageResponse,
  Review,
  SessionUser,
  Tab,
  UserRoute,
} from '../types';

type CommunityRoutesCache = Partial<Record<CommunityRouteSort, UserRoute[]>>;

interface UseAppTabDataLoadersParams {
  activeTab: Tab;
  adminSummary: AdminSummaryResponse | null;
  myPage: MyPageResponse | null;
  sessionUser: SessionUser | null;
  communityRoutesCacheRef: MutableRefObject<CommunityRoutesCache>;
  feedLoadedRef: MutableRefObject<boolean>;
  coursesLoadedRef: MutableRefObject<boolean>;
  replaceCommunityRoutes: (nextRoutes: UserRoute[], sort?: CommunityRouteSort) => void;
  setCommunityRoutes: Dispatch<SetStateAction<UserRoute[]>>;
  setReviews: Dispatch<SetStateAction<Review[]>>;
  setFeedHasMore: Dispatch<SetStateAction<boolean>>;
  setFeedNextCursor: Dispatch<SetStateAction<string | null>>;
  setCourses: Dispatch<SetStateAction<Course[]>>;
  setAdminLoading: Dispatch<SetStateAction<boolean>>;
  setAdminSummary: Dispatch<SetStateAction<AdminSummaryResponse | null>>;
  setMyPage: Dispatch<SetStateAction<MyPageResponse | null>>;
  setMyPageError: Dispatch<SetStateAction<string | null>>;
}

export function useAppTabDataLoaders({
  activeTab,
  adminSummary,
  myPage,
  sessionUser,
  communityRoutesCacheRef,
  feedLoadedRef,
  coursesLoadedRef,
  replaceCommunityRoutes,
  setCommunityRoutes,
  setReviews,
  setFeedHasMore,
  setFeedNextCursor,
  setCourses,
  setAdminLoading,
  setAdminSummary,
  setMyPage,
  setMyPageError,
}: UseAppTabDataLoadersParams) {
  const fetchCommunityRoutes = useCallback(async (sort: CommunityRouteSort, force = false) => {
    const cached = communityRoutesCacheRef.current[sort];
    if (!force && cached) {
      setCommunityRoutes(cached);
      return cached;
    }

    const nextRoutes = await getCommunityRoutes(sort);
    replaceCommunityRoutes(nextRoutes, sort);
    return nextRoutes;
  }, [communityRoutesCacheRef, replaceCommunityRoutes, setCommunityRoutes]);

  const ensureFeedReviews = useCallback(async (force = false) => {
    if (!force && feedLoadedRef.current) {
      return;
    }

    const page = await getReviewFeedPage({ limit: 10 });
    setReviews(toReviewSummaryList(page.items));
    setFeedNextCursor(page.nextCursor);
    setFeedHasMore(Boolean(page.nextCursor));
    feedLoadedRef.current = true;
  }, [feedLoadedRef, setFeedHasMore, setFeedNextCursor, setReviews]);

  const ensureCuratedCourses = useCallback(async (force = false) => {
    if (!force && coursesLoadedRef.current) {
      return;
    }

    setCourses((current) => current);
    coursesLoadedRef.current = true;
  }, [coursesLoadedRef, setCourses]);

  const refreshAdminSummary = useCallback(async (force = false) => {
    if (!sessionUser?.isAdmin) {
      setAdminSummary(null);
      return null;
    }

    if (!force && activeTab !== 'my' && adminSummary !== null) {
      return adminSummary;
    }

    setAdminLoading(true);
    try {
      const nextSummary = await getAdminSummary();
      setAdminSummary(nextSummary);
      return nextSummary;
    } finally {
      setAdminLoading(false);
    }
  }, [activeTab, adminSummary, sessionUser, setAdminLoading, setAdminSummary]);

  const refreshMyPageForUser = useCallback(async (user: SessionUser | null, force = false) => {
    if (!user) {
      setMyPage(null);
      setMyPageError(null);
      return null;
    }

    if (!force && activeTab !== 'my' && myPage === null) {
      return null;
    }

    try {
      const nextMyPage = await getMySummary();
      const nextMyPageSummary = {
        ...nextMyPage,
        reviews: toReviewSummaryList(nextMyPage.reviews),
      };
      setMyPage(nextMyPageSummary);
      setMyPageError(null);
      return nextMyPageSummary;
    } catch (error) {
      setMyPage(null);
      setMyPageError(error instanceof Error ? error.message : '마이페이지 정보를 불러오지 못했어요.');
      if (activeTab !== 'my') {
        return null;
      }
      throw error;
    }
  }, [activeTab, myPage, setMyPage, setMyPageError]);

  return {
    fetchCommunityRoutes,
    ensureFeedReviews,
    ensureCuratedCourses,
    refreshAdminSummary,
    refreshMyPageForUser,
  };
}
