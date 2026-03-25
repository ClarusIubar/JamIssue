import { useEffect, useMemo, useState } from 'react';
import {
  claimStamp,
  createComment,
  updateComment,
  deleteComment,
  deleteReview,
  createReview,
  updateReview,
  createUserRoute,
  deleteNotification,
  getAuthSession,
  getFestivals,
  getMapBootstrap,
  getMyCommentsPage,
  markAllNotificationsRead,
  markNotificationRead,
  getProviderLoginUrl,
  getReviewDetail,
  getReviewFeedPage,
  getReviews,
  importPublicData,
  logout,
  toggleCommunityRouteLike,
  toggleReviewLike,
  updatePlaceVisibility,
  updateProfile,
  uploadReviewImage,
} from './api/client';
import { BottomNav } from './components/BottomNav';
import { CourseTab } from './components/CourseTab';
import { EventTab } from './components/EventTab';
import { FeedTab } from './components/FeedTab';
import { FloatingBackButton } from './components/FloatingBackButton';
import { GlobalStatusBanner } from './components/GlobalStatusBanner';
import { MapTabStage } from './components/MapTabStage';
import { MyPagePanel } from './components/MyPagePanel';
import {
  useAppRouteState,
  clearAuthQueryParams,
  getInitialNotice,
  getLoginReturnUrl,
  getInitialMapViewport,
  updateMapViewportInUrl,
} from './hooks/useAppRouteState';
import { useAppDataState } from './hooks/useAppDataState';
import { useAppTabDataLoaders } from './hooks/useAppTabDataLoaders';
import { getCurrentDevicePosition } from './lib/geolocation';
import {
  calculateDistanceMeters,
  formatDistanceMeters,
  getLatestPlaceStamp,
  getPlaceVisitCount,
  getTodayStampLog,
} from './lib/visits';
import type {
  ApiStatus,
  Category,
  CommunityRouteSort,
  DrawerState,
  FestivalItem,
  MyPageTabKey,
  Place,
  ReviewMood,
  RoutePreview,
  SessionUser,
  Tab,
} from './types';

const STAMP_UNLOCK_RADIUS_METERS = 120;



function filterPlacesByCategory(places: Place[], category: Category) {
  if (category === 'all') {
    return places;
  }

  return places.filter((place) => place.category === category);
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '\uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uB4A4\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.';
}

function reportBackgroundError(error: unknown) {
  console.error(error);
}

function TabPanelFallback() {
  return (
    <section className="page-panel page-panel--scrollable page-panel--loading">
      <div className="page-panel__loading-copy">Loading...</div>
    </section>
  );
}

export default function App() {
  const {
    activeTab,
    drawerState,
    selectedPlaceId,
    selectedFestivalId,
    setSelectedPlaceId,
    setSelectedFestivalId,
    commitRouteState,
    goToTab,
    openPlace,
    openFestival,
    closeDrawer,
  } = useAppRouteState();

  const [initialMapViewport] = useState(getInitialMapViewport);

  const [myPageTab, setMyPageTab] = useState<MyPageTabKey>('stamps');
  const [feedPlaceFilterId, setFeedPlaceFilterId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [notice, setNotice] = useState<string | null>(getInitialNotice);
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapLocationStatus, setMapLocationStatus] = useState<ApiStatus>('idle');
  const [mapLocationMessage, setMapLocationMessage] = useState<string | null>(null);
  const [mapLocationFocusKey, setMapLocationFocusKey] = useState(0);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewLikeUpdatingId, setReviewLikeUpdatingId] = useState<string | null>(null);
  const [commentSubmittingReviewId, setCommentSubmittingReviewId] = useState<string | null>(null);
  const [commentMutatingId, setCommentMutatingId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [activeCommentReviewId, setActiveCommentReviewId] = useState<string | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);
  const [returnView, setReturnView] = useState<{
    tab: Tab;
    myPageTab: MyPageTabKey;
    activeCommentReviewId: string | null;
    highlightedCommentId: string | null;
    highlightedReviewId: string | null;
    placeId: string | null;
    festivalId: string | null;
    drawerState: DrawerState;
    feedPlaceFilterId: string | null;
  } | null>(null);
  const [stampActionStatus, setStampActionStatus] = useState<ApiStatus>('idle');
  const [stampActionMessage, setStampActionMessage] = useState('장소를 선택하면 오늘 스탬프 가능 여부를 바로 확인할 수 있어요.');
  const [routeSubmitting, setRouteSubmitting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLikeUpdatingId, setRouteLikeUpdatingId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [myPageError, setMyPageError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [feedNextCursor, setFeedNextCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [myCommentsNextCursor, setMyCommentsNextCursor] = useState<string | null>(null);
  const [myCommentsHasMore, setMyCommentsHasMore] = useState(false);
  const [myCommentsLoadingMore, setMyCommentsLoadingMore] = useState(false);
  const [myCommentsLoadedOnce, setMyCommentsLoadedOnce] = useState(false);

  const {
    bootstrapStatus,
    setBootstrapStatus,
    bootstrapError,
    setBootstrapError,
    places,
    setPlaces,
    festivals,
    setFestivals,
    reviews,
    setReviews,
    selectedPlaceReviews,
    setSelectedPlaceReviews,
    courses,
    setCourses,
    stampState,
    setStampState,
    hasRealData,
    setHasRealData,
    sessionUser,
    setSessionUser,
    providers,
    setProviders,
    communityRoutes,
    setCommunityRoutes,
    communityRouteSort,
    setCommunityRouteSort,
    myPage,
    setMyPage,
    adminSummary,
    setAdminSummary,
    adminBusyPlaceId,
    setAdminBusyPlaceId,
    adminLoading,
    setAdminLoading,
    selectedRoutePreview,
    setSelectedRoutePreview,
    communityRoutesCacheRef,
    placeReviewsCacheRef,
    feedLoadedRef,
    coursesLoadedRef,
    replaceCommunityRoutes,
    patchCommunityRoutes,
    patchReviewCollections,
    upsertReviewCollections,
    resetReviewCaches,
  } = useAppDataState(selectedPlaceId);

  const filteredPlaces = useMemo(() => filterPlacesByCategory(places, activeCategory), [places, activeCategory]);
  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) {
      return null;
    }

    return places.find((place) => place.id === selectedPlaceId) ?? null;
  }, [places, selectedPlaceId]);
  const routePreviewPlaces = useMemo(() => {
    if (!selectedRoutePreview) {
      return [];
    }

    return selectedRoutePreview.placeIds
      .map((placeId) => places.find((place) => place.id === placeId) ?? null)
      .filter(Boolean) as Place[];
  }, [places, selectedRoutePreview]);

  const selectedFestival = useMemo(() => {
    if (!selectedFestivalId) {
      return null;
    }

    return festivals.find((festival) => festival.id === selectedFestivalId) ?? null;
  }, [festivals, selectedFestivalId]);
  const todayStamp = selectedPlace ? getTodayStampLog(stampState.logs, selectedPlace.id) : null;
  const latestStamp = selectedPlace ? getLatestPlaceStamp(stampState.logs, selectedPlace.id) : null;
  const visitCount = selectedPlace ? getPlaceVisitCount(stampState.logs, selectedPlace.id) : 0;
  const selectedPlaceDistanceMeters =
    selectedPlace && currentPosition
      ? calculateDistanceMeters(currentPosition.latitude, currentPosition.longitude, selectedPlace.latitude, selectedPlace.longitude)
      : null;
  const knownMyReviews = useMemo(() => {
    if (!sessionUser) {
      return [];
    }

    const reviewMap = new Map();
    for (const review of [...reviews, ...selectedPlaceReviews, ...(myPage?.reviews ?? [])]) {
      if (review.userId !== sessionUser.id) {
        continue;
      }
      reviewMap.set(review.id, review);
    }

    return [...reviewMap.values()];
  }, [myPage?.reviews, reviews, selectedPlaceReviews, sessionUser]);
  const hasCreatedReviewToday = useMemo(() => {
    if (!sessionUser || !todayStamp) {
      return false;
    }

    return knownMyReviews.some((review) => review.stampId === todayStamp.id || review.visitedAt.startsWith(todayStamp.stampedDate));
  }, [knownMyReviews, sessionUser, todayStamp]);
  const canCreateReview = Boolean(sessionUser && selectedPlace && todayStamp && !hasCreatedReviewToday);
  const placeNameById = useMemo(() => Object.fromEntries(places.map((place) => [place.id, place.name])), [places]);
  const globalStatus = useMemo(() => {
    if (notice) {
      return { tone: 'info' as const, message: notice };
    }
    if (bootstrapStatus === 'loading') {
      return { tone: 'info' as const, message: '지도를 준비하고 있어요.' };
    }
    if (bootstrapStatus === 'error' && bootstrapError) {
      return { tone: 'error' as const, message: bootstrapError };
    }
    if (mapLocationMessage) {
      return {
        tone: mapLocationStatus === 'error' ? ('error' as const) : ('info' as const),
        message: mapLocationMessage,
      };
    }
    return null;
  }, [notice, bootstrapStatus, bootstrapError, mapLocationMessage, mapLocationStatus]);
  const {
    fetchCommunityRoutes,
    ensureFeedReviews,
    ensureCuratedCourses,
    refreshAdminSummary,
    refreshMyPageForUser,
  } = useAppTabDataLoaders({
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
  });

  function handleOpenReviewComments(reviewId: string, commentId: string | null = null) {
    goToTab('feed');
    setHighlightedReviewId(reviewId ?? null);
    setActiveCommentReviewId(reviewId);
    setHighlightedCommentId(commentId);
  }

  function handleCloseReviewComments() {
    setActiveCommentReviewId(null);
    setHighlightedCommentId(null);
  }

  function handleOpenRoutePreview(route: RoutePreview) {
    if (activeTab !== 'map') {
      setReturnView({
        tab: activeTab,
        myPageTab,
        activeCommentReviewId,
        highlightedCommentId,
        highlightedReviewId,
        placeId: selectedPlaceId,
        festivalId: selectedFestivalId,
        drawerState,
        feedPlaceFilterId,
      });
    }
    setSelectedRoutePreview(route);
    handleCloseReviewComments();
    commitRouteState({ tab: 'map', placeId: null, festivalId: null, drawerState: 'closed' }, activeTab === 'map' ? 'replace' : 'push');
  }

  function handleOpenPlaceWithReturn(placeId: string) {
    if (activeTab !== 'map') {
      const preserveFeedFocus = activeTab !== 'feed';
      setReturnView({
        tab: activeTab,
        myPageTab,
        activeCommentReviewId: preserveFeedFocus ? activeCommentReviewId : null,
        highlightedCommentId: preserveFeedFocus ? highlightedCommentId : null,
        highlightedReviewId: preserveFeedFocus ? highlightedReviewId : null,
        placeId: selectedPlaceId,
        festivalId: selectedFestivalId,
        drawerState,
        feedPlaceFilterId,
      });
    }
    setSelectedRoutePreview(null);
    openPlace(placeId);
  }


  function handleOpenFestivalWithReturn(festivalId: string) {
    if (activeTab !== 'map') {
      setReturnView({
        tab: activeTab,
        myPageTab,
        activeCommentReviewId,
        highlightedCommentId,
        highlightedReviewId,
        placeId: selectedPlaceId,
        festivalId: selectedFestivalId,
        drawerState,
        feedPlaceFilterId,
      });
    }
    setSelectedRoutePreview(null);
    openFestival(festivalId);
  }
  async function ensureReviewLoadedById(reviewId: string | null) {
    if (!reviewId) {
      return null;
    }

    const existing = [...reviews, ...selectedPlaceReviews, ...(myPage?.reviews ?? [])].find((review) => review.id === reviewId) ?? null;
    if (existing) {
      upsertReviewCollections(existing);
      return existing;
    }

    try {
      const loaded = await getReviewDetail(reviewId);
      upsertReviewCollections(loaded);
      return loaded;
    } catch (error) {
      setNotice(formatErrorMessage(error));
      return null;
    }
  }

  async function handleOpenReviewWithReturn(reviewId: string | null) {
    await ensureReviewLoadedById(reviewId);
    if (activeTab !== 'feed') {
      setReturnView({
        tab: activeTab,
        myPageTab,
        activeCommentReviewId,
        highlightedCommentId,
        highlightedReviewId,
        placeId: selectedPlaceId,
        festivalId: selectedFestivalId,
        drawerState,
        feedPlaceFilterId,
      });
    }
    setFeedPlaceFilterId(null);
    setHighlightedReviewId(reviewId);
    setHighlightedCommentId(null);
    setActiveCommentReviewId(null);
    goToTab('feed');
  }

  function handleOpenPlaceFeedWithReturn(placeId: string) {
    if (activeTab !== 'feed') {
      setReturnView({
        tab: activeTab,
        myPageTab,
        activeCommentReviewId,
        highlightedCommentId,
        highlightedReviewId,
        placeId: selectedPlaceId,
        festivalId: selectedFestivalId,
        drawerState,
        feedPlaceFilterId,
      });
    }
    setSelectedRoutePreview(null);
    setSelectedRoutePreview(null);
    setFeedPlaceFilterId(placeId);
    setHighlightedReviewId(null);
    setHighlightedCommentId(null);
    setActiveCommentReviewId(null);
    goToTab('feed');
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

  async function handleOpenCommentWithReturn(reviewId: string, commentId: string | null = null) {
    if (activeTab !== 'feed') {
      setReturnView({
        tab: activeTab,
        myPageTab,
        activeCommentReviewId,
        highlightedCommentId,
        highlightedReviewId,
        placeId: selectedPlaceId,
        festivalId: selectedFestivalId,
        drawerState,
        feedPlaceFilterId,
      });
    }
    await ensureReviewLoadedById(reviewId);
    handleOpenReviewComments(reviewId, commentId);
  }

  useEffect(() => {
    if (!selectedPlace) {
      setStampActionMessage('\uC7A5\uC18C\uB97C \uC120\uD0DD\uD558\uBA74 \uC624\uB298 \uC2A4\uD0EC\uD504 \uAC00\uB2A5 \uC5EC\uBD80\uB97C \uBC14\uB85C \uD655\uC778\uD560 \uC218 \uC788\uC5B4\uC694.');
      return;
    }

    if (!sessionUser) {
      setStampActionMessage(`${selectedPlace.name}\uC5D0\uC11C \uC2A4\uD0EC\uD504\uB97C \uCC0D\uC73C\uB824\uBA74 \uBA3C\uC800 \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.`);
      return;
    }

    if (todayStamp) {
      setStampActionMessage(`${todayStamp.visitLabel} \uC624\uB298 \uC2A4\uD0EC\uD504\uB97C \uC774\uBBF8 \uCC0D\uC5C8\uC5B4\uC694.`);
      return;
    }

    if (typeof selectedPlaceDistanceMeters !== 'number') {
      setStampActionMessage('\uD604\uC7AC \uC704\uCE58\uB97C \uD655\uC778\uD558\uBA74 \uC624\uB298 \uC2A4\uD0EC\uD504 \uAC00\uB2A5 \uC5EC\uBD80\uB97C \uBC14\uB85C \uC548\uB0B4\uD574 \uB4DC\uB9B4\uAC8C\uC694.');
      return;
    }

    if (selectedPlaceDistanceMeters <= STAMP_UNLOCK_RADIUS_METERS) {
      setStampActionMessage(`\uD604\uC7A5 \uBC18\uACBD ${formatDistanceMeters(selectedPlaceDistanceMeters)} \uC548\uC774\uC5D0\uC694. \uC9C0\uAE08 \uBC14\uB85C \uC624\uB298 \uC2A4\uD0EC\uD504\uB97C \uCC0D\uC744 \uC218 \uC788\uC5B4\uC694.`);
      return;
    }

    setStampActionMessage(`\uD604\uC7A5\uAE4C\uC9C0 ${formatDistanceMeters(selectedPlaceDistanceMeters)} \uB0A8\uC544 \uC788\uC5B4\uC694. ${STAMP_UNLOCK_RADIUS_METERS}m \uC548\uC73C\uB85C \uB4E4\uC5B4\uC624\uBA74 \uC624\uB298 \uC2A4\uD0EC\uD504\uB97C \uCC0D\uC744 \uC218 \uC788\uC5B4\uC694.`);
  }, [selectedPlace, selectedPlaceDistanceMeters, sessionUser, todayStamp]);

  useEffect(() => {
    void loadApp(true);
  }, []);

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
    communityRouteSort,
    sessionUser,
    myPage,
    myPageTab,
    adminSummary,
    myCommentsLoadedOnce,
  ]);

  useEffect(() => {
    if (activeTab !== 'map') {
      setSelectedPlaceReviews([]);
      return;
    }

    if (!selectedPlaceId) {
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
  }, [activeTab, selectedPlaceId]);

  async function loadApp(withLoading: boolean) {
    const authParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
    const authState = authParams?.get('auth');

    if (withLoading) {
      setBootstrapStatus('loading');
    }
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
        if (activeTab === 'my') {
          await refreshMyPageForUser(bootstrap.auth.user, true);
        }
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
  }

  async function refreshCurrentPosition(shouldFocusMap: boolean) {
    setMapLocationStatus('loading');
    setMapLocationMessage('현재 위치를 확인하고 있어요.');

    try {
      const nextPosition = await getCurrentDevicePosition();
      setCurrentPosition({ latitude: nextPosition.latitude, longitude: nextPosition.longitude });
      setMapLocationStatus('ready');
      setMapLocationMessage(`현재 위치를 확인했어요. 위치 정확도는 약 ${formatDistanceMeters(nextPosition.accuracyMeters)}예요.`);
      if (shouldFocusMap) {
        setMapLocationFocusKey((current) => current + 1);
      }
    } catch (error) {
      setCurrentPosition(null);
      setMapLocationStatus('error');
      setMapLocationMessage(formatErrorMessage(error));
    }
  }

  function startProviderLogin(provider: 'naver' | 'kakao') {
    window.location.assign(getProviderLoginUrl(provider, getLoginReturnUrl()));
  }

  async function handleClaimStamp(place: Place) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('로그인하면 스탬프를 찍고 피드도 남길 수 있어요.');
      return;
    }

    setStampActionStatus('loading');
    try {
      const nextPosition = await getCurrentDevicePosition();
      setCurrentPosition({ latitude: nextPosition.latitude, longitude: nextPosition.longitude });
      const nextStampState = await claimStamp({
        placeId: place.id,
        latitude: nextPosition.latitude,
        longitude: nextPosition.longitude,
      });
      setStampState(nextStampState);
        setNotice(`${place.name}에서 오늘 스탬프를 찍었어요.`);
      commitRouteState(
        {
          tab: 'map',
          placeId: place.id,
          festivalId: null,
          drawerState: 'full',
        },
        'replace',
      );
      await refreshMyPageForUser(sessionUser);
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setStampActionStatus('ready');
    }
  }

  async function handleCreateReview(payload: { stampId: string; body: string; mood: ReviewMood; file: File | null }) {
    if (!sessionUser || !selectedPlace) {
      goToTab('my');
      return;
    }
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      let imageUrl: string | null = null;
      if (payload.file) {
        const uploaded = await uploadReviewImage(payload.file);
        imageUrl = uploaded.url;
      }
      const createdReview = await createReview({
        placeId: selectedPlace.id,
        stampId: payload.stampId,
        body: payload.body.trim(),
        mood: payload.mood,
        imageUrl,
      });
      upsertReviewCollections(createdReview);
      await refreshMyPageForUser(sessionUser);
      setNotice('피드를 남겼어요. 이제 다른 장소도 이어서 둘러볼 수 있어요.');
      commitRouteState(
        {
          tab: 'map',
          placeId: selectedPlace.id,
          festivalId: null,
          drawerState: 'full',
        },
        'replace',
      );
    } catch (error) {
      setReviewError(formatErrorMessage(error));
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleUpdateReview(reviewId: string, payload: { body: string; mood: ReviewMood }) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('피드를 수정하려면 먼저 로그인해 주세요.');
      return;
    }

    try {
      const updatedReview = await updateReview(reviewId, {
        body: payload.body.trim(),
        mood: payload.mood,
      });
      patchReviewCollections(reviewId, () => updatedReview);
      setMyPage((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          reviews: current.reviews.map((review) => (review.id === reviewId ? updatedReview : review)),
          comments: current.comments.map((comment) => (
            comment.reviewId === reviewId
              ? { ...comment, reviewBody: updatedReview.body }
              : comment
          )),
        };
      });
      setNotice('피드를 수정했어요.');
    } catch (error) {
      throw error;
    }
  }

  async function handleCreateComment(reviewId: string, body: string, parentId?: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('댓글을 남기려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentSubmittingReviewId(reviewId);
    try {
      const updatedComments = await createComment(reviewId, { body, parentId: parentId ?? null });
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        comments: updatedComments,
        commentCount: updatedComments.length,
      }));
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentSubmittingReviewId(null);
    }
  }

  async function handleUpdateComment(reviewId: string, commentId: string, body: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('댓글을 수정하려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentMutatingId(commentId);
    try {
      const updatedComments = await updateComment(reviewId, commentId, { body });
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        comments: updatedComments,
        commentCount: updatedComments.length,
      }));
      if (activeTab === 'my') {
        await refreshMyPageForUser(sessionUser, true);
      }
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentMutatingId(null);
    }
  }

  async function handleDeleteComment(reviewId: string, commentId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('댓글을 삭제하려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentMutatingId(commentId);
    try {
      const updatedComments = await deleteComment(reviewId, commentId);
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        comments: updatedComments,
        commentCount: updatedComments.length,
      }));
      if (activeTab === 'my') {
        await refreshMyPageForUser(sessionUser, true);
      }
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentMutatingId(null);
    }
  }

  async function handleDeleteReview(reviewId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('피드를 삭제하려면 먼저 로그인해 주세요.');
      return;
    }
    if (!window.confirm('이 피드를 삭제할까요?')) {
      return;
    }

    setDeletingReviewId(reviewId);
    try {
      await deleteReview(reviewId);
      setReviews((current) => current.filter((review) => review.id !== reviewId));
      setSelectedPlaceReviews((current) => current.filter((review) => review.id !== reviewId));
      for (const placeId of Object.keys(placeReviewsCacheRef.current)) {
        placeReviewsCacheRef.current[placeId] = placeReviewsCacheRef.current[placeId].filter((review) => review.id !== reviewId);
      }
      setMyPage((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          reviews: current.reviews.filter((review) => review.id !== reviewId),
          comments: current.comments.filter((comment) => comment.reviewId !== reviewId),
          stats: {
            ...current.stats,
            reviewCount: Math.max(0, current.stats.reviewCount - 1),
          },
        };
      });
      if (activeCommentReviewId === reviewId) {
        handleCloseReviewComments();
      }
      if (highlightedReviewId === reviewId) {
        setHighlightedReviewId(null);
      }
      setNotice('피드를 삭제했어요.');
      if (activeTab === 'my') {
        await refreshMyPageForUser(sessionUser, true);
      }
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setDeletingReviewId(null);
    }
  }

  async function handleToggleReviewLike(reviewId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('좋아요를 누르려면 먼저 로그인해 주세요.');
      return;
    }

    const targetReview = reviews.find((review) => review.id === reviewId)
      ?? selectedPlaceReviews.find((review) => review.id === reviewId)
      ?? myPage?.reviews.find((review) => review.id === reviewId)
      ?? null;
    const previousLikedByMe = targetReview?.likedByMe ?? false;
    const previousLikeCount = targetReview?.likeCount ?? 0;
    const optimisticLikedByMe = !previousLikedByMe;
    const optimisticLikeCount = Math.max(0, previousLikeCount + (optimisticLikedByMe ? 1 : -1));

    patchReviewCollections(reviewId, (review) => ({
      ...review,
      likeCount: optimisticLikeCount,
      likedByMe: optimisticLikedByMe,
    }));

    setReviewLikeUpdatingId(reviewId);
    try {
      const result = await toggleReviewLike(reviewId);
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        likeCount: result.likeCount,
        likedByMe: result.likedByMe,
      }));
    } catch (error) {
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        likeCount: previousLikeCount,
        likedByMe: previousLikedByMe,
      }));
      setNotice(formatErrorMessage(error));
    } finally {
      setReviewLikeUpdatingId(null);
    }
  }

  async function handleToggleRouteLike(routeId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('좋아요를 누르려면 먼저 로그인해 주세요.');
      return;
    }
    setRouteLikeUpdatingId(routeId);
    try {
      const result = await toggleCommunityRouteLike(routeId);
      patchCommunityRoutes(routeId, (route) => ({
        ...route,
        likeCount: result.likeCount,
        likedByMe: result.likedByMe,
      }));
      setMyPage((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          routes: current.routes.map((route) =>
            route.id === routeId
              ? {
                  ...route,
                  likeCount: result.likeCount,
                  likedByMe: result.likedByMe,
                }
              : route,
          ),
        };
      });
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setRouteLikeUpdatingId(null);
    }
  }

  async function handlePublishRoute(payload: { travelSessionId: string; title: string; description: string; mood: string }) {
    if (!sessionUser) {
      goToTab('my');
      setRouteError('로그인하면 여행 세션을 코스로 발행할 수 있어요.');
      return;
    }
    setRouteSubmitting(true);
    setRouteError(null);
    try {
      const createdRoute = await createUserRoute({
        travelSessionId: payload.travelSessionId,
        title: payload.title,
        description: payload.description,
        mood: payload.mood,
        isPublic: true,
      });
      communityRoutesCacheRef.current = {
        ...communityRoutesCacheRef.current,
        latest: [createdRoute, ...(communityRoutesCacheRef.current.latest ?? []).filter((route) => route.id !== createdRoute.id)],
      };
      delete communityRoutesCacheRef.current.popular;
      setMyPage((current) => {
        if (!current) {
          return current;
        }
        const routeExists = current.routes.some((route) => route.id === createdRoute.id);
        return {
          ...current,
          routes: [createdRoute, ...current.routes.filter((route) => route.id !== createdRoute.id)],
          travelSessions: current.travelSessions.map((session) =>
            session.id === payload.travelSessionId ? { ...session, publishedRouteId: createdRoute.id } : session,
          ),
          stats: {
            ...current.stats,
            routeCount: routeExists ? current.stats.routeCount : current.stats.routeCount + 1,
          },
        };
      });
      setNotice('코스를 발행했어요. 공개 경로 탭에서 바로 확인할 수 있어요.');
      setMyPageTab('routes');
      await refreshMyPageForUser(sessionUser, true);
    } catch (error) {
      setRouteError(formatErrorMessage(error));
    } finally {
      setRouteSubmitting(false);
    }
  }

  async function handleMarkNotificationRead(notificationId: string) {
    await markNotificationRead(notificationId);
    setMyPage((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        notifications: current.notifications.map((notification) => (
          notification.id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )),
        unreadNotificationCount: Math.max(
          0,
          current.notifications.filter((notification) => !notification.isRead && notification.id !== notificationId).length,
        ),
      };
    });
  }

  async function handleMarkAllNotificationsRead() {
    await markAllNotificationsRead();
    setMyPage((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        notifications: current.notifications.map((notification) => ({ ...notification, isRead: true })),
        unreadNotificationCount: 0,
      };
    });
  }

  async function handleDeleteNotification(notificationId: string) {
    await deleteNotification(notificationId);
    setMyPage((current) => {
      if (!current) {
        return current;
      }
      const nextNotifications = current.notifications.filter((notification) => notification.id !== notificationId);
      return {
        ...current,
        notifications: nextNotifications,
        unreadNotificationCount: nextNotifications.filter((notification) => !notification.isRead).length,
      };
    });
  }

  async function handleToggleAdminPlace(placeId: string, nextValue: boolean) {
    if (!sessionUser?.isAdmin) {
      return;
    }
    setAdminBusyPlaceId(placeId);
    try {
      const updated = await updatePlaceVisibility(placeId, { isActive: nextValue });
      setAdminSummary((current) => current ? {
        ...current,
        places: current.places.map((place) => place.id === placeId ? updated : place),
      } : current);
      const nextMap = await getMapBootstrap();
      setPlaces(nextMap.places);
      setStampState(nextMap.stamps);
      setHasRealData(nextMap.hasRealData);
      setNotice(nextValue ? '\uC7A5\uC18C \uB178\uCD9C\uC744 \uCF1C\uB450\uC5C8\uC5B4\uC694.' : '\uC7A5\uC18C \uB178\uCD9C\uC744 \uC228\uACBC\uC5B4\uC694.');
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setAdminBusyPlaceId(null);
    }
  }


  async function handleToggleAdminManualOverride(placeId: string, nextValue: boolean) {
    if (!sessionUser?.isAdmin) {
      return;
    }
    setAdminBusyPlaceId(placeId);
    try {
      const updated = await updatePlaceVisibility(placeId, { isManualOverride: nextValue });
      setAdminSummary((current) => current ? {
        ...current,
        places: current.places.map((place) => place.id === placeId ? updated : place),
      } : current);
      setNotice(nextValue ? '공공데이터 자동 동기화에서 보호해둘게요.' : '공공데이터 자동 동기화 보호를 해제했어요.');
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setAdminBusyPlaceId(null);
    }
  }

  async function handleRefreshAdminImport() {
    if (!sessionUser?.isAdmin) {
      return;
    }

    setAdminLoading(true);
    try {
      await importPublicData();
      const [nextSummary, nextMap, nextFestivals] = await Promise.all([
        refreshAdminSummary(true),
        getMapBootstrap(),
        getFestivals(),
      ]);
      if (nextSummary) {
        setAdminSummary(nextSummary);
      }
      setPlaces(nextMap.places);
      setStampState(nextMap.stamps);
      setHasRealData(nextMap.hasRealData);
      setFestivals(nextFestivals);
      setNotice('행사 데이터를 다시 불러왔어요.');
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleUpdateProfile(nextNickname: string) {
    if (!nextNickname || nextNickname.length < 2) {
      setProfileError('닉네임은 두 글자 이상으로 입력해 주세요.');
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    try {
      const auth = await updateProfile({ nickname: nextNickname });
      setSessionUser(auth.user);
      if (auth.user) {
        setMyPage((current) => (current && auth.user ? { ...current, user: auth.user } : current));
      }
      setNotice('닉네임을 저장했어요. 이제 같은 계정으로 기록을 이어볼 수 있어요.');
    } catch (error) {
      setProfileError(formatErrorMessage(error));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const auth = await logout();
      setSessionUser(auth.user);
      setProviders(auth.providers);
      setMyPage(null);
      setNotice('로그아웃했어요.');
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setIsLoggingOut(false);
    }
  }

  const canNavigateBack =
    returnView !== null ||
    activeCommentReviewId !== null ||
    activeTab !== 'map' ||
    selectedPlaceId !== null ||
    selectedFestivalId !== null ||
    drawerState !== 'closed' ||
    selectedRoutePreview !== null ||
    (typeof window !== 'undefined' && window.history.length > 1);

  function handleNavigateBack() {
    if (returnView) {
      setMyPageTab(returnView.myPageTab);
      setActiveCommentReviewId(returnView.activeCommentReviewId);
      setHighlightedCommentId(returnView.highlightedCommentId);
      setHighlightedReviewId(returnView.highlightedReviewId);
      setFeedPlaceFilterId(returnView.feedPlaceFilterId);
      setSelectedRoutePreview(null);
      setSelectedRoutePreview(null);
      const nextTab = returnView.tab;
      setReturnView(null);
      commitRouteState(
        {
          tab: nextTab,
          placeId: nextTab === 'map' ? returnView.placeId : null,
          festivalId: nextTab === 'map' ? returnView.festivalId : null,
          drawerState: nextTab === 'map' ? returnView.drawerState : 'closed',
        },
        'replace',
      );
      return;
    }

    if (selectedRoutePreview) {
      setSelectedRoutePreview(null);
      return;
    }

    if (selectedRoutePreview) {
      setSelectedRoutePreview(null);
      return;
    }

    if (activeCommentReviewId !== null) {
      handleCloseReviewComments();
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }

    handleCloseReviewComments();
    goToTab('map', 'replace');
  }

  function handleBottomNavChange(nextTab: Tab) {
    setSelectedRoutePreview(null);
    handleCloseReviewComments();

    if (nextTab !== 'feed') {
      setFeedPlaceFilterId(null);
      setHighlightedReviewId(null);
    }

    if (nextTab === 'map') {
      commitRouteState(
        {
          tab: 'map',
          placeId: selectedPlaceId,
          festivalId: selectedFestivalId,
          drawerState,
        },
        'replace',
      );
      return;
    }

    commitRouteState(
      {
        tab: nextTab,
        placeId: null,
        festivalId: null,
        drawerState: 'closed',
      },
      'push',
    );
  }

  const reviewProofMessage = !sessionUser
    ? '\uB85C\uADF8\uC778\uD558\uBA74 \uC624\uB298 \uBC29\uBB38 \uC778\uC99D \uB4A4\uC5D0\uB9CC \uD53C\uB4DC\uB97C \uB0A8\uAE38 \uC218 \uC788\uC5B4\uC694.'
    : hasCreatedReviewToday
      ? '\uC624\uB298\uC740 \uC774\uBBF8 \uC774 \uC7A5\uC18C \uD53C\uB4DC\uB97C \uC791\uC131\uD588\uC5B4\uC694. \uD53C\uB4DC\uB294 \uD558\uB8E8\uC5D0 \uD558\uB098\uB9CC \uB0A8\uAE38 \uC218 \uC788\uC5B4\uC694.'
      : todayStamp
        ? `${todayStamp.visitLabel} \uBC29\uBB38 \uC2A4\uD0EC\uD504\uAC00 \uD655\uC778\uB410\uC5B4\uC694. \uC624\uB298 \uD53C\uB4DC \uD55C \uAC1C\uB97C \uC791\uC131\uD560 \uC218 \uC788\uC5B4\uC694.`
        : '\uC624\uB298 \uBC29\uBB38 \uC2A4\uD0EC\uD504\uB97C \uBA3C\uC800 \uCC0D\uC73C\uBA74 \uD53C\uB4DC\uB97C \uC791\uC131\uD560 \uC218 \uC788\uC5B4\uC694.';

  return (
    <div className="map-app-shell">
      <div className={[
        'phone-shell',
        activeTab === 'map' ? 'phone-shell--map' : '',
        globalStatus ? 'phone-shell--with-status' : '',
      ].filter(Boolean).join(' ')}>
        {globalStatus && <GlobalStatusBanner tone={globalStatus.tone} message={globalStatus.message} layout={activeTab === 'map' ? 'map' : 'page'} />}
        {activeTab === 'map' ? (
          <MapTabStage
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            filteredPlaces={filteredPlaces}
            festivals={festivals}
            selectedPlace={selectedPlace}
            selectedFestival={selectedFestival}
            currentPosition={currentPosition}
            mapLocationStatus={mapLocationStatus}
            mapLocationFocusKey={mapLocationFocusKey}
            drawerState={drawerState}
            sessionUser={sessionUser}
            selectedPlaceReviews={selectedPlaceReviews}
            routePreview={selectedRoutePreview}
            routePreviewPlaces={routePreviewPlaces}
            visitCount={visitCount}
            latestStamp={latestStamp}
            todayStamp={todayStamp}
            stampActionStatus={stampActionStatus}
            stampActionMessage={stampActionMessage}
            reviewProofMessage={reviewProofMessage}
            reviewError={reviewError}
            reviewSubmitting={reviewSubmitting}
            canCreateReview={canCreateReview}
            hasCreatedReviewToday={hasCreatedReviewToday}
            onOpenFeedReview={() => {
              if (!selectedPlace) {
                return;
              }
              handleOpenPlaceFeedWithReturn(selectedPlace.id);
            }}
            initialMapCenter={{ lat: initialMapViewport.lat, lng: initialMapViewport.lng }}
            initialMapZoom={initialMapViewport.zoom}
            onOpenPlace={(placeId) => {
              setSelectedRoutePreview(null);
              openPlace(placeId);
            }}
            onOpenFestival={(festivalId) => {
              setSelectedRoutePreview(null);
              openFestival(festivalId);
            }}
            onCloseDrawer={closeDrawer}
            onClearRoutePreview={() => setSelectedRoutePreview(null)}
            onExpandPlaceDrawer={() =>
              selectedPlace &&
              commitRouteState({ tab: 'map', placeId: selectedPlace.id, festivalId: null, drawerState: 'full' }, 'replace')
            }
            onCollapsePlaceDrawer={() =>
              selectedPlace &&
              commitRouteState({ tab: 'map', placeId: selectedPlace.id, festivalId: null, drawerState: 'partial' }, 'replace')
            }
            onExpandFestivalDrawer={() =>
              selectedFestival &&
              commitRouteState({ tab: 'map', placeId: null, festivalId: selectedFestival.id, drawerState: 'full' }, 'replace')
            }
            onCollapseFestivalDrawer={() =>
              selectedFestival &&
              commitRouteState({ tab: 'map', placeId: null, festivalId: selectedFestival.id, drawerState: 'partial' }, 'replace')
            }
            onRequestLogin={() => goToTab('my')}
            onClaimStamp={handleClaimStamp}
            onCreateReview={handleCreateReview}
            onLocateCurrentPosition={() => void refreshCurrentPosition(true)}
            onMapViewportChange={updateMapViewportInUrl}
          />
        ) : (
          <div className={globalStatus ? 'page-stage page-stage--with-banner' : 'page-stage'}>

            {activeTab === 'feed' && (
              <FeedTab
                reviews={reviews}
                sessionUser={sessionUser}
                reviewLikeUpdatingId={reviewLikeUpdatingId}
                placeFilterId={feedPlaceFilterId}
                placeFilterName={feedPlaceFilterId ? placeNameById[feedPlaceFilterId] ?? null : null}
                commentSubmittingReviewId={commentSubmittingReviewId}
                commentMutatingId={commentMutatingId}
                deletingReviewId={deletingReviewId}
                activeCommentReviewId={activeCommentReviewId}
                highlightedCommentId={highlightedCommentId}
                highlightedReviewId={highlightedReviewId}
                hasMore={feedHasMore && !feedPlaceFilterId}
                loadingMore={feedLoadingMore}
                onLoadMore={loadMoreFeedReviews}
                onToggleReviewLike={handleToggleReviewLike}
                onCreateComment={handleCreateComment}
                onUpdateComment={handleUpdateComment}
                onDeleteComment={handleDeleteComment}
                onDeleteReview={handleDeleteReview}
                onRequestLogin={() => goToTab('my')}
                onClearPlaceFilter={() => setFeedPlaceFilterId(null)}
                onOpenPlace={handleOpenPlaceWithReturn}
                onOpenComments={handleOpenReviewComments}
                onCloseComments={handleCloseReviewComments}
              />
            )}

            {activeTab === 'event' && (
              <EventTab festivals={festivals} />
            )}

            {activeTab === 'course' && (
              <CourseTab
                curatedCourses={courses}
                communityRoutes={communityRoutes}
                sort={communityRouteSort}
                sessionUser={sessionUser}
                routeLikeUpdatingId={routeLikeUpdatingId}
                placeNameById={placeNameById}
                onChangeSort={(sort) => {
                  setCommunityRouteSort(sort);
                  void fetchCommunityRoutes(sort)
                    .catch(reportBackgroundError);
                }}
                onToggleLike={handleToggleRouteLike}
                onOpenPlace={handleOpenPlaceWithReturn}
                onOpenRoutePreview={handleOpenRoutePreview}
                onRequestLogin={() => goToTab('my')}
              />
            )}

            {activeTab === 'my' && (
              <MyPagePanel
                sessionUser={sessionUser}
                myPage={myPage}
                providers={providers}
                myPageError={myPageError}
                activeTab={myPageTab}
                isLoggingOut={isLoggingOut}
                profileSaving={profileSaving}
                profileError={profileError}
                routeSubmitting={routeSubmitting}
                routeError={routeError}
                adminSummary={adminSummary}
                adminBusyPlaceId={adminBusyPlaceId}
                adminLoading={adminLoading}
                onChangeTab={setMyPageTab}
                onLogin={startProviderLogin}
                onRetry={async () => { if (sessionUser) { await refreshMyPageForUser(sessionUser, true); } }}
                onLogout={handleLogout}
                onSaveNickname={handleUpdateProfile}
                onPublishRoute={handlePublishRoute}
                onOpenPlace={handleOpenPlaceWithReturn}
                onOpenComment={(reviewId, commentId) => handleOpenCommentWithReturn(reviewId, commentId)}
                onOpenReview={handleOpenReviewWithReturn}
                onUpdateReview={handleUpdateReview}
                onDeleteReview={handleDeleteReview}
                onMarkNotificationRead={handleMarkNotificationRead}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
                onDeleteNotification={handleDeleteNotification}
                commentsHasMore={myCommentsHasMore}
                commentsLoadingMore={myCommentsLoadingMore}
                onLoadMoreComments={loadMoreMyComments}
                onRefreshAdmin={handleRefreshAdminImport}
                onToggleAdminPlace={handleToggleAdminPlace}
                onToggleAdminManualOverride={handleToggleAdminManualOverride}
              />
            )}
          </div>
        )}

        {canNavigateBack && <FloatingBackButton onNavigateBack={handleNavigateBack} />}

        <BottomNav activeTab={activeTab} onChange={handleBottomNavChange} />
      </div>
    </div>
  );
}


