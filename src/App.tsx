import { useEffect, useMemo, useState } from 'react';
import {
  claimStamp,
  createComment,
  updateComment,
  deleteComment,
  deleteReview,
  createReview,
  createUserRoute,
  getFestivals,
  getMapBootstrap,
  getProviderLoginUrl,
  getReviews,
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

  return '?붿껌??泥섎━?섎뒗 以?臾몄젣媛 ?앷꼈?댁슂. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??';
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
  const [stampActionMessage, setStampActionMessage] = useState('?μ냼瑜??좏깮?섎㈃ ?ㅻ뒛 諛⑸Ц ?몄쬆 媛???щ?瑜?諛붾줈 ?뺤씤?????덉뼱??');
  const [routeSubmitting, setRouteSubmitting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLikeUpdatingId, setRouteLikeUpdatingId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [myPageError, setMyPageError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
  function handleOpenReviewWithReturn(reviewId: string | null) {
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

  function handleOpenCommentWithReturn(reviewId: string, commentId: string | null = null) {
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
    handleOpenReviewComments(reviewId, commentId);
  }

  useEffect(() => {
    void loadApp(true);
  }, []);

  useEffect(() => {
    if (activeTab !== 'map' || mapLocationStatus !== 'idle') {
      return;
    }

    void refreshCurrentPosition(false);
  }, [activeTab, mapLocationStatus]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (activeTab === 'my' && sessionUser && !myPage) {
      void refreshMyPageForUser(sessionUser, true);
    }
    if (activeTab === 'my' && sessionUser?.isAdmin && !adminSummary) {
      void refreshAdminSummary(true).catch((error) => {
        setNotice(formatErrorMessage(error));
      });
    }
  }, [activeTab, adminSummary, myPage, refreshAdminSummary, refreshMyPageForUser, sessionUser]);

  useEffect(() => {
    if (activeTab !== 'course') {
      return;
    }

    void ensureCuratedCourses().catch((error) => {
      setNotice(formatErrorMessage(error));
    });

    const cached = communityRoutesCacheRef.current[communityRouteSort];
    if (cached) {
      setCommunityRoutes(cached);
      return;
    }

    void fetchCommunityRoutes(communityRouteSort, true).catch((error) => {
      setNotice(formatErrorMessage(error));
    });
  }, [activeTab, communityRouteSort, communityRoutesCacheRef, ensureCuratedCourses, fetchCommunityRoutes, setCommunityRoutes]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (communityRoutesCacheRef.current[communityRouteSort]) {
      return;
    }

    const run = () => {
      void fetchCommunityRoutes(communityRouteSort, true).catch(() => {});
    };

    const timeout = window.setTimeout(run, 180);
    return () => window.clearTimeout(timeout);
  }, [communityRouteSort, communityRoutesCacheRef, fetchCommunityRoutes]);

  useEffect(() => {
    if (activeTab !== 'feed' && activeCommentReviewId === null) {
      return;
    }

    void ensureFeedReviews().catch((error) => {
      setNotice(formatErrorMessage(error));
    });
  }, [activeCommentReviewId, activeTab, ensureFeedReviews]);

  useEffect(() => {
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
      .catch((error) => {
        setNotice(formatErrorMessage(error));
      });
  }, [placeReviewsCacheRef, selectedPlaceId, setSelectedPlaceReviews]);

  useEffect(() => {
    if (activeTab !== 'feed' && activeCommentReviewId !== null) {
      setActiveCommentReviewId(null);
      setHighlightedCommentId(null);
    }
  }, [activeCommentReviewId, activeTab]);

  useEffect(() => {
    if (!selectedPlaceId) {
      return;
    }

    const isVisibleInCurrentCategory = filteredPlaces.some((place) => place.id === selectedPlaceId);
    if (!isVisibleInCurrentCategory) {
      commitRouteState(
        {
          tab: 'map',
          placeId: null,
          festivalId: null,
          drawerState: 'closed',
        },
        'replace',
      );
    }
  }, [commitRouteState, filteredPlaces, selectedPlaceId]);
  useEffect(() => {
    if (!selectedPlace) {
      setStampActionMessage('?μ냼瑜??좏깮?섎㈃ ?ㅻ뒛 諛⑸Ц ?몄쬆 媛???щ?瑜?諛붾줈 ?뺤씤?????덉뼱??');
      return;
    }

    if (!sessionUser) {
      setStampActionMessage(`${selectedPlace.name}?먯꽌 ?몄쬆?섎젮硫?癒쇱? 濡쒓렇?명빐 二쇱꽭??`);
      return;
    }

    if (todayStamp) {
      setStampActionMessage(`${todayStamp.visitLabel} ?ㅻ뒛 諛⑸Ц ?몄쬆???대? 留덉낀?댁슂.`);
      return;
    }

    if (typeof selectedPlaceDistanceMeters !== 'number') {
      setStampActionMessage('?꾩옱 ?꾩튂瑜??뺤씤?섎㈃ ?ㅻ뒛 諛⑸Ц ?몄쬆 媛???щ?瑜?諛붾줈 ?덈궡???쒕┫寃뚯슂.');
      return;
    }

    if (selectedPlaceDistanceMeters <= STAMP_UNLOCK_RADIUS_METERS) {
      setStampActionMessage(`?꾩옣 諛섍꼍 ${formatDistanceMeters(selectedPlaceDistanceMeters)} ?덉씠?먯슂. 吏湲?諛붾줈 ?ㅻ뒛 諛⑸Ц ?몄쬆??吏꾪뻾?????덉뼱??`);
      return;
    }

    setStampActionMessage(`?꾩옣源뚯? ${formatDistanceMeters(selectedPlaceDistanceMeters)} ?⑥븯?댁슂. ${STAMP_UNLOCK_RADIUS_METERS}m ?덉쑝濡??ㅼ뼱?ㅻ㈃ ?ㅻ뒛 諛⑸Ц ?몄쬆???????덉뼱??`);
  }, [selectedPlace, selectedPlaceDistanceMeters, sessionUser, todayStamp]);

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
        setNotice('?됰꽕?꾩쓣 ?뺥븯硫??쇰뱶? 肄붿뒪瑜?媛숈? 怨꾩젙 湲곕줉?쇰줈 ?먯뿰?ㅻ읇寃??댁뼱媛????덉뼱??');
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
    setMapLocationMessage('?꾩옱 ?꾩튂瑜??뺤씤?섍퀬 ?덉뼱??');

    try {
      const nextPosition = await getCurrentDevicePosition();
      setCurrentPosition({ latitude: nextPosition.latitude, longitude: nextPosition.longitude });
      setMapLocationStatus('ready');
      setMapLocationMessage(`?꾩옱 ?꾩튂瑜??뺤씤?덉뼱?? ?꾩튂 ?ㅼ감????${formatDistanceMeters(nextPosition.accuracyMeters)}?덉슂.`);
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
      setNotice('濡쒓렇?명븯硫??꾩옣 諛⑸Ц ?몄쬆???섍퀬 ?쇰뱶? 肄붿뒪瑜??댁뼱???????덉뼱??');
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
      setNotice(`${place.name}?먯꽌 ?ㅻ뒛 諛⑸Ц ?몄쬆???꾨즺?덉뼱??`);
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
      setNotice('?쇰뱶瑜??④꼈?댁슂. 媛숈? ?좎뿉????媛쒖쓽 ?쇰뱶留??묒꽦?????덉뼱??');
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

  async function handleCreateComment(reviewId: string, body: string, parentId?: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('?볤????④린?ㅻ㈃ 癒쇱? 濡쒓렇?명빐 二쇱꽭??');
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
      setNotice('?볤????섏젙?섎젮硫?癒쇱? 濡쒓렇?명빐 二쇱꽭??');
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
      setNotice('?볤?????젣?섎젮硫?癒쇱? 濡쒓렇?명빐 二쇱꽭??');
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
      setNotice('?쇰뱶瑜???젣?섎젮硫?癒쇱? 濡쒓렇?명빐 二쇱꽭??');
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
      setNotice('?쇰뱶瑜???젣?덉뼱??');
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
      setNotice('醫뗭븘?붾? ?꾨Ⅴ?ㅻ㈃ 癒쇱? 濡쒓렇?명빐 二쇱꽭??');
      return;
    }

    setReviewLikeUpdatingId(reviewId);
    try {
      const result = await toggleReviewLike(reviewId);
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        likeCount: result.likeCount,
        likedByMe: result.likedByMe,
      }));
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setReviewLikeUpdatingId(null);
    }
  }

  async function handleToggleRouteLike(routeId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('醫뗭븘?붾? ?꾨Ⅴ?ㅻ㈃ 癒쇱? 濡쒓렇?명빐 二쇱꽭??');
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
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setRouteLikeUpdatingId(null);
    }
  }

  async function handlePublishRoute(payload: { travelSessionId: string; title: string; description: string; mood: string }) {
    if (!sessionUser) {
      goToTab('my');
      setRouteError('濡쒓렇?명븯硫??ы뻾 ?몄뀡??怨듦컻 肄붿뒪濡?諛쒗뻾?????덉뼱??');
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
      setNotice('肄붿뒪瑜?諛쒗뻾?덉뼱?? ?댁젣 ?ㅻⅨ ?ъ슜?먭? 理쒖떊?쒓낵 醫뗭븘?붿닚?쇰줈 蹂????덉뼱??');
      setMyPageTab('routes');
    } catch (error) {
      setRouteError(formatErrorMessage(error));
    } finally {
      setRouteSubmitting(false);
    }
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

  async function handleUpdateProfile(nextNickname: string) {
    if (!nextNickname || nextNickname.length < 2) {
      setProfileError('?됰꽕?꾩? ??湲???댁긽?쇰줈 ?낅젰??二쇱꽭??');
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
      setNotice('?됰꽕?꾩쓣 ??ν뻽?댁슂. ?댁젣 ???대쫫?쇰줈 ?쇰뱶? 肄붿뒪媛 ?쒖떆?쇱슂.');
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
      setNotice('濡쒓렇?꾩썐?덉뼱??');
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setIsLoggingOut(false);
    }
  }

  const canNavigateBack = activeCommentReviewId !== null || activeTab !== 'map' || selectedPlaceId !== null || selectedFestivalId !== null || drawerState !== 'closed' || selectedRoutePreview !== null;

  function handleNavigateBack() {
    if (returnView && activeTab !== returnView.tab) {
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
    ? '濡쒓렇?명븯硫??ㅻ뒛 諛⑸Ц ?몄쬆 ?ㅼ뿉留??쇰뱶瑜??④만 ???덉뼱??'
    : hasCreatedReviewToday
      ? '?ㅻ뒛? ?대? ?쇰뱶瑜??묒꽦?덉뼱?? ?쇰뱶???섎（???섎굹留??④만 ???덉뼱??'
      : todayStamp
        ? `${todayStamp.visitLabel} 諛⑸Ц ?몄쬆???꾨즺?먯뼱?? ?ㅻ뒛 ?쇰뱶 ??媛쒕? ?묒꽦?????덉뼱??`
        : '?ㅻ뒛 諛⑸Ц ?몄쬆??癒쇱? 留덉퀜???쇰뱶瑜??묒꽦?????덉뼱??';

  return (
    <div className="map-app-shell">
      <div className={activeTab === 'map' ? 'phone-shell phone-shell--map' : 'phone-shell'}>
        {activeTab === 'map' ? (
          <MapTabStage
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            notice={notice}
            bootstrapStatus={bootstrapStatus}
            bootstrapError={bootstrapError}
            filteredPlaces={filteredPlaces}
            festivals={festivals}
            selectedPlace={selectedPlace}
            selectedFestival={selectedFestival}
            currentPosition={currentPosition}
            mapLocationStatus={mapLocationStatus}
            mapLocationMessage={mapLocationMessage}
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
          <div className="page-stage">
            {notice && <div className="floating-notice">{notice}</div>}
            {bootstrapStatus === 'loading' && <section className="floating-status">遺덈윭?ㅻ뒗 以묒씠?먯슂.</section>}
            {bootstrapStatus === 'error' && <section className="floating-status floating-status--error">{bootstrapError}</section>}

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

            {activeTab === 'event' && <EventTab festivals={festivals} onOpenFestival={handleOpenFestivalWithReturn} />}

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
                    .catch((error) => setNotice(formatErrorMessage(error)));
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
                onDeleteReview={handleDeleteReview}
                onRefreshAdmin={async () => {
                  await refreshAdminSummary(true);
                }}
                onToggleAdminPlace={handleToggleAdminPlace}
              />
            )}
          </div>
        )}

        {canNavigateBack && (
          <button type="button" className="app-back-button" onClick={handleNavigateBack} aria-label="이전 화면으로 돌아가기">
            <span aria-hidden="true">{'\u2190'}</span>
          </button>
        )}

        <BottomNav activeTab={activeTab} onChange={handleBottomNavChange} />
      </div>
    </div>
  );
}


