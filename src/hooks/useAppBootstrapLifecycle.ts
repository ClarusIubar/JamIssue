import { useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getFestivals, getMapBootstrap, getReviews } from '../api/client';
import { toReviewSummaryList } from '../lib/reviews';
import { useAuthStore } from '../store/auth-store';
import { useAppRuntimeStore } from '../store/app-runtime-store';
import { useAppRouteStore } from '../store/app-route-store';
import { clearAuthQueryParams } from './useAppRouteState';
import type {
  AdminSummaryResponse,
  ApiStatus,
  FestivalItem,
  MyPageResponse,
  Place,
  Review,
  SessionUser,
  StampState,
  Tab,
} from '../types';

interface UseAppBootstrapLifecycleParams {
  activeTab: Tab;
  selectedPlaceId: string | null;
  sessionUser: SessionUser | null;
  myPage: MyPageResponse | null;
  myPageTab: string;
  adminSummary: AdminSummaryResponse | null;
  communityRouteSort: 'popular' | 'latest';
  myCommentsLoadedOnce: boolean;
  placeReviewsCacheRef: MutableRefObject<Record<string, Review[]>>;
  setBootstrapStatus: (status: ApiStatus) => void;
  setBootstrapError: (message: string | null) => void;
  setPlaces: Dispatch<SetStateAction<Place[]>>;
  setFestivals: Dispatch<SetStateAction<FestivalItem[]>>;
  setStampState: Dispatch<SetStateAction<StampState>>;
  setHasRealData: Dispatch<SetStateAction<boolean>>;
  setSelectedPlaceReviews: Dispatch<SetStateAction<Review[]>>;
  setMyPage: Dispatch<SetStateAction<MyPageResponse | null>>;
  resetReviewCaches: () => void;
  refreshMyPageForUser: (user: SessionUser | null, force?: boolean) => Promise<MyPageResponse | null>;
  ensureFeedReviews: (force?: boolean) => Promise<void>;
  ensureCuratedCourses: (force?: boolean) => Promise<void>;
  fetchCommunityRoutes: (sort: 'popular' | 'latest', force?: boolean) => Promise<unknown>;
  refreshAdminSummary: (force?: boolean) => Promise<AdminSummaryResponse | null>;
  loadMoreMyComments: (initial?: boolean) => Promise<void>;
  goToTab: (tab: Tab, historyMode?: 'push' | 'replace') => void;
  formatErrorMessage: (error: unknown) => string;
  reportBackgroundError: (error: unknown) => void;
}

export function useAppBootstrapLifecycle({
  activeTab,
  selectedPlaceId,
  sessionUser,
  myPage,
  myPageTab,
  adminSummary,
  communityRouteSort,
  myCommentsLoadedOnce,
  placeReviewsCacheRef,
  setBootstrapStatus,
  setBootstrapError,
  setPlaces,
  setFestivals,
  setStampState,
  setHasRealData,
  setSelectedPlaceReviews,
  setMyPage,
  resetReviewCaches,
  refreshMyPageForUser,
  ensureFeedReviews,
  ensureCuratedCourses,
  fetchCommunityRoutes,
  refreshAdminSummary,
  loadMoreMyComments,
  goToTab,
  formatErrorMessage,
  reportBackgroundError,
}: UseAppBootstrapLifecycleParams) {
  const setSessionUser = useAuthStore((state) => state.setSessionUser);
  const setProviders = useAuthStore((state) => state.setProviders);
  const setSelectedPlaceId = useAppRouteStore((state) => state.setSelectedPlaceId);
  const setSelectedFestivalId = useAppRouteStore((state) => state.setSelectedFestivalId);
  const setNotice = useAppRuntimeStore((state) => state.setNotice);
  const setFeedNextCursor = useAppRuntimeStore((state) => state.setFeedNextCursor);
  const setFeedHasMore = useAppRuntimeStore((state) => state.setFeedHasMore);
  const setFeedLoadingMore = useAppRuntimeStore((state) => state.setFeedLoadingMore);
  const setMyCommentsNextCursor = useAppRuntimeStore((state) => state.setMyCommentsNextCursor);
  const setMyCommentsHasMore = useAppRuntimeStore((state) => state.setMyCommentsHasMore);
  const setMyCommentsLoadingMore = useAppRuntimeStore((state) => state.setMyCommentsLoadingMore);
  const setMyCommentsLoadedOnce = useAppRuntimeStore((state) => state.setMyCommentsLoadedOnce);

  const refreshMyPageForUserRef = useRef(refreshMyPageForUser);
  const resetReviewCachesRef = useRef(resetReviewCaches);
  const goToTabRef = useRef(goToTab);
  const formatErrorMessageRef = useRef(formatErrorMessage);
  const reportBackgroundErrorRef = useRef(reportBackgroundError);

  useEffect(() => {
    refreshMyPageForUserRef.current = refreshMyPageForUser;
  }, [refreshMyPageForUser]);

  useEffect(() => {
    resetReviewCachesRef.current = resetReviewCaches;
  }, [resetReviewCaches]);

  useEffect(() => {
    goToTabRef.current = goToTab;
  }, [goToTab]);

  useEffect(() => {
    formatErrorMessageRef.current = formatErrorMessage;
  }, [formatErrorMessage]);

  useEffect(() => {
    reportBackgroundErrorRef.current = reportBackgroundError;
  }, [reportBackgroundError]);

  useEffect(() => {
    if (!selectedPlaceId || activeTab !== 'map') {
      setSelectedPlaceReviews([]);
      return;
    }

    const cachedReviews = placeReviewsCacheRef.current[selectedPlaceId];
    if (cachedReviews) {
      setSelectedPlaceReviews(cachedReviews);
      return;
    }

    void getReviews({ placeId: selectedPlaceId })
      .then((nextReviews) => {
        const nextReviewSummaries = toReviewSummaryList(nextReviews);
        placeReviewsCacheRef.current[selectedPlaceId] = nextReviewSummaries;
        setSelectedPlaceReviews(nextReviewSummaries);
      })
      .catch(reportBackgroundError);
  }, [activeTab, placeReviewsCacheRef, reportBackgroundError, selectedPlaceId, setSelectedPlaceReviews]);

  useEffect(() => {
    if (activeTab === 'feed') {
      void ensureFeedReviews().catch(reportBackgroundError);
      return;
    }

    if (activeTab === 'course') {
      void fetchCommunityRoutes(communityRouteSort).catch(reportBackgroundError);
      return;
    }

    if (activeTab === 'my') {
      if (sessionUser && myPage === null) {
        void refreshMyPageForUser(sessionUser, true).catch(reportBackgroundError);
      }
      if (sessionUser?.isAdmin && myPageTab === 'admin' && adminSummary === null) {
        void refreshAdminSummary().catch(reportBackgroundError);
      }
      if (sessionUser && myPage && myPageTab === 'comments' && !myCommentsLoadedOnce) {
        void loadMoreMyComments(true);
      }
    }
  }, [
    activeTab,
    adminSummary,
    communityRouteSort,
    ensureCuratedCourses,
    ensureFeedReviews,
    fetchCommunityRoutes,
    loadMoreMyComments,
    myCommentsLoadedOnce,
    myPage,
    myPageTab,
    refreshAdminSummary,
    refreshMyPageForUser,
    reportBackgroundError,
    sessionUser,
  ]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const authParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
      const authState = authParams?.get('auth');

      setBootstrapStatus('loading');
      setBootstrapError(null);

      try {
        const bootstrap = await getMapBootstrap();
        if (!active) {
          return;
        }

        setPlaces(bootstrap.places);
        setStampState(bootstrap.stamps);
        setHasRealData(bootstrap.hasRealData);
        setSessionUser(bootstrap.auth.user);
        resetReviewCachesRef.current();
        setFeedNextCursor(null);
        setFeedHasMore(false);
        setFeedLoadingMore(false);
        setMyCommentsNextCursor(null);
        setMyCommentsHasMore(false);
        setMyCommentsLoadingMore(false);
        setMyCommentsLoadedOnce(false);
        setProviders(bootstrap.auth.providers);
        setSelectedPlaceId((current) => (current && bootstrap.places.some((place) => place.id === current) ? current : null));
        setSelectedFestivalId(null);

        if (bootstrap.auth.user) {
          await refreshMyPageForUserRef.current(bootstrap.auth.user, true);
          if (!active) {
            return;
          }
        } else {
          setMyPage(null);
        }

        setBootstrapStatus('ready');
        if (authState === 'naver-success' && bootstrap.auth.user?.profileCompletedAt === null) {
          goToTabRef.current('my');
          setNotice('닉네임을 먼저 정하면 같은 계정으로 스탬프와 피드를 이어서 남길 수 있어요.');
        }
      } catch (error) {
        setBootstrapError(formatErrorMessageRef.current(error));
        setBootstrapStatus('error');
      } finally {
        clearAuthQueryParams();
      }
    })();

    void getFestivals()
      .then((festivalResult) => {
        if (!active) {
          return;
        }
        setFestivals(festivalResult);
        setSelectedFestivalId((current) => (current && festivalResult.some((festival) => festival.id === current) ? current : null));
      })
      .catch((error) => reportBackgroundErrorRef.current(error));

    return () => {
      active = false;
    };
  }, [
    setBootstrapError,
    setBootstrapStatus,
    setFeedHasMore,
    setFeedLoadingMore,
    setFeedNextCursor,
    setFestivals,
    setHasRealData,
    setMyCommentsHasMore,
    setMyCommentsLoadedOnce,
    setMyCommentsLoadingMore,
    setMyCommentsNextCursor,
    setMyPage,
    setNotice,
    setPlaces,
    setProviders,
    setSelectedFestivalId,
    setSelectedPlaceId,
    setSessionUser,
    setStampState,
  ]);
}
