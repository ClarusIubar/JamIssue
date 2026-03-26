import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getFestivals, getMapBootstrap, getReviews } from '../api/client';
import { clearAuthQueryParams } from './useAppRouteState';
import type {
  AdminSummaryResponse,
  ApiStatus,
  AuthProvider,
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
  setSessionUser: Dispatch<SetStateAction<SessionUser | null>>;
  setProviders: Dispatch<SetStateAction<AuthProvider[]>>;
  setSelectedPlaceId: Dispatch<SetStateAction<string | null>>;
  setSelectedFestivalId: Dispatch<SetStateAction<string | null>>;
  setSelectedPlaceReviews: Dispatch<SetStateAction<Review[]>>;
  setNotice: (message: string | null) => void;
  setFeedNextCursor: Dispatch<SetStateAction<string | null>>;
  setFeedHasMore: Dispatch<SetStateAction<boolean>>;
  setFeedLoadingMore: Dispatch<SetStateAction<boolean>>;
  setMyCommentsNextCursor: Dispatch<SetStateAction<string | null>>;
  setMyCommentsHasMore: Dispatch<SetStateAction<boolean>>;
  setMyCommentsLoadingMore: Dispatch<SetStateAction<boolean>>;
  setMyCommentsLoadedOnce: Dispatch<SetStateAction<boolean>>;
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
  setSessionUser,
  setProviders,
  setSelectedPlaceId,
  setSelectedFestivalId,
  setSelectedPlaceReviews,
  setNotice,
  setFeedNextCursor,
  setFeedHasMore,
  setFeedLoadingMore,
  setMyCommentsNextCursor,
  setMyCommentsHasMore,
  setMyCommentsLoadingMore,
  setMyCommentsLoadedOnce,
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
        placeReviewsCacheRef.current[selectedPlaceId] = nextReviews;
        setSelectedPlaceReviews(nextReviews);
      })
      .catch(reportBackgroundError);
  }, [activeTab, placeReviewsCacheRef, reportBackgroundError, selectedPlaceId, setSelectedPlaceReviews]);

  useEffect(() => {
    if (activeTab === 'feed') {
      void ensureFeedReviews().catch(reportBackgroundError);
      return;
    }

    if (activeTab === 'course') {
      void ensureCuratedCourses().catch(reportBackgroundError);
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
    void (async () => {
      const authParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
      const authState = authParams?.get('auth');

      setBootstrapStatus('loading');
      setBootstrapError(null);

      try {
        const [bootstrap, festivalResult] = await Promise.all([
          getMapBootstrap(),
          getFestivals().catch(() => [] as FestivalItem[]),
        ]);

        setPlaces(bootstrap.places);
        setFestivals(festivalResult);
        setStampState(bootstrap.stamps);
        setHasRealData(bootstrap.hasRealData);
        setSessionUser(bootstrap.auth.user);
        resetReviewCaches();
        setFeedNextCursor(null);
        setFeedHasMore(false);
        setFeedLoadingMore(false);
        setMyCommentsNextCursor(null);
        setMyCommentsHasMore(false);
        setMyCommentsLoadingMore(false);
        setMyCommentsLoadedOnce(false);
        setProviders(bootstrap.auth.providers);
        setSelectedPlaceId((current) => (current && bootstrap.places.some((place) => place.id === current) ? current : null));
        setSelectedFestivalId((current) => (current && festivalResult.some((festival) => festival.id === current) ? current : null));

        if (bootstrap.auth.user) {
          await refreshMyPageForUser(bootstrap.auth.user, true);
        } else {
          setMyPage(null);
        }

        setBootstrapStatus('ready');
        if (authState === 'naver-success' && bootstrap.auth.user?.profileCompletedAt === null) {
          goToTab('my');
          setNotice('닉네임을 먼저 정하면 같은 계정으로 스탬프와 피드를 이어서 남길 수 있어요.');
        }
      } catch (error) {
        setBootstrapError(formatErrorMessage(error));
        setBootstrapStatus('error');
      } finally {
        clearAuthQueryParams();
      }
    })();
  }, [
    formatErrorMessage,
    goToTab,
    refreshMyPageForUser,
    resetReviewCaches,
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
