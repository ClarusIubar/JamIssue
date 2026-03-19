import { useEffect, useMemo, useRef, useState } from 'react';
import {
  claimStamp,
  createComment,
  createReview,
  createUserRoute,
  getAuthSession,
  getBootstrap,
  getCommunityRoutes,
  getFestivals,
  getMySummary,
  getProviderLoginUrl,
  logout,
  toggleCommunityRouteLike,
  toggleReviewLike,
  updateProfile,
  uploadReviewImage,
} from './api/client';
import { BottomNav } from './components/BottomNav';
import { CourseTab } from './components/CourseTab';
import { FeedTab } from './components/FeedTab';
import { MapTabStage } from './components/MapTabStage';
import { MyPagePanel } from './components/MyPagePanel';
import { useAppRouteState, clearAuthQueryParams, getInitialNotice, getLoginReturnUrl, getInitialMapViewport, updateMapViewportInUrl } from './hooks/useAppRouteState';
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
  AuthProvider,
  BootstrapResponse,
  Category,
  CommunityRouteSort,
  FestivalItem,
  MyPageResponse,
  MyPageTabKey,
  Place,
  ReviewMood,
  SessionUser,
  Tab,
  UserRoute,
} from './types';

const emptyProviders: AuthProvider[] = [
  { key: 'naver', label: '네이버', isEnabled: false, loginUrl: null },
  { key: 'kakao', label: '카카오', isEnabled: false, loginUrl: null },
];

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

  return '요청을 처리하지 못했어요.';
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
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [notice, setNotice] = useState<string | null>(getInitialNotice);
  const [bootstrapStatus, setBootstrapStatus] = useState<ApiStatus>('idle');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [festivals, setFestivals] = useState<FestivalItem[]>([]);
  const [reviews, setReviews] = useState<BootstrapResponse['reviews']>([]);
  const [courses, setCourses] = useState<BootstrapResponse['courses']>([]);
  const [stampState, setStampState] = useState<BootstrapResponse['stamps']>({
    collectedPlaceIds: [],
    logs: [],
    travelSessions: [],
  });
  const [hasRealData, setHasRealData] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [providers, setProviders] = useState<AuthProvider[]>(emptyProviders);
  const [communityRoutes, setCommunityRoutes] = useState<UserRoute[]>([]);
  const [communityRouteSort, setCommunityRouteSort] = useState<CommunityRouteSort>('popular');
  const [myPage, setMyPage] = useState<MyPageResponse | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapLocationStatus, setMapLocationStatus] = useState<ApiStatus>('idle');
  const [mapLocationMessage, setMapLocationMessage] = useState<string | null>(null);
  const [mapLocationFocusKey, setMapLocationFocusKey] = useState(0);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewLikeUpdatingId, setReviewLikeUpdatingId] = useState<string | null>(null);
  const [commentSubmittingReviewId, setCommentSubmittingReviewId] = useState<string | null>(null);
  const [activeCommentReviewId, setActiveCommentReviewId] = useState<string | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [returnView, setReturnView] = useState<{ tab: Tab; myPageTab: MyPageTabKey; activeCommentReviewId: string | null; highlightedCommentId: string | null } | null>(null);
  const [stampActionStatus, setStampActionStatus] = useState<ApiStatus>('idle');
  const [stampActionMessage, setStampActionMessage] = useState('장소를 선택하면 오늘 스탬프 가능 여부를 바로 알려드릴게요.');
  const [routeSubmitting, setRouteSubmitting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLikeUpdatingId, setRouteLikeUpdatingId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const communityRoutesCacheRef = useRef<Partial<Record<CommunityRouteSort, UserRoute[]>>>({});

  const filteredPlaces = useMemo(() => filterPlacesByCategory(places, activeCategory), [places, activeCategory]);
  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) {
      return null;
    }

    return places.find((place) => place.id === selectedPlaceId) ?? null;
  }, [places, selectedPlaceId]);
  const selectedFestival = useMemo(() => {
    if (!selectedFestivalId) {
      return null;
    }

    return festivals.find((festival) => festival.id === selectedFestivalId) ?? null;
  }, [festivals, selectedFestivalId]);
  const selectedPlaceReviews = selectedPlace ? reviews.filter((review) => review.placeId === selectedPlace.id) : [];
  const todayStamp = selectedPlace ? getTodayStampLog(stampState.logs, selectedPlace.id) : null;
  const latestStamp = selectedPlace ? getLatestPlaceStamp(stampState.logs, selectedPlace.id) : null;
  const visitCount = selectedPlace ? getPlaceVisitCount(stampState.logs, selectedPlace.id) : 0;
  const selectedPlaceDistanceMeters =
    selectedPlace && currentPosition
      ? calculateDistanceMeters(currentPosition.latitude, currentPosition.longitude, selectedPlace.latitude, selectedPlace.longitude)
      : null;
  const canCreateReview = Boolean(sessionUser && selectedPlace && todayStamp);
  const placeNameById = useMemo(() => Object.fromEntries(places.map((place) => [place.id, place.name])), [places]);
  function replaceCommunityRoutes(nextRoutes: UserRoute[], sort: CommunityRouteSort = communityRouteSort) {
    communityRoutesCacheRef.current[sort] = nextRoutes;
    setCommunityRoutes(nextRoutes);
  }
  async function fetchCommunityRoutes(sort: CommunityRouteSort, force = false) {
    const cached = communityRoutesCacheRef.current[sort];
    if (!force && cached) {
      setCommunityRoutes(cached);
      return cached;
    }
    const nextRoutes = await getCommunityRoutes(sort);
    communityRoutesCacheRef.current[sort] = nextRoutes;
    setCommunityRoutes(nextRoutes);
    return nextRoutes;
  }
  function patchCommunityRoutes(routeId: string, updater: (route: UserRoute) => UserRoute) {
    const nextCache: Partial<Record<CommunityRouteSort, UserRoute[]>> = {};
    for (const sortKey of Object.keys(communityRoutesCacheRef.current) as CommunityRouteSort[]) {
      const routes = communityRoutesCacheRef.current[sortKey];
      if (!routes) {
        continue;
      }
      nextCache[sortKey] = routes.map((route) => (route.id === routeId ? updater(route) : route));
    }
    communityRoutesCacheRef.current = nextCache;
    setCommunityRoutes((current) => current.map((route) => (route.id === routeId ? updater(route) : route)));
  }
  async function refreshMyPageForUser(user: SessionUser | null, force = false) {
    if (!user) {
      setMyPage(null);
      return null;
    }
    if (!force && activeTab !== 'my' && myPage === null) {
      return null;
    }
    const nextMyPage = await getMySummary();
    setMyPage(nextMyPage);
    return nextMyPage;
  }

  function handleOpenReviewComments(reviewId: string, commentId: string | null = null) {
    goToTab('feed');
    setActiveCommentReviewId(reviewId);
    setHighlightedCommentId(commentId);
  }

  function handleCloseReviewComments() {
    setActiveCommentReviewId(null);
    setHighlightedCommentId(null);
  }

  function handleOpenPlaceWithReturn(placeId: string) {
    if (activeTab !== 'map') {
      setReturnView({
        tab: activeTab,
        myPageTab,
        activeCommentReviewId,
        highlightedCommentId,
      });
    }
    openPlace(placeId);
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
  }, [activeTab, myPage, sessionUser]);

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
      setStampActionMessage('장소를 선택하면 오늘 스탬프 가능 여부를 바로 알려드릴게요.');
      return;
    }

    if (!sessionUser) {
      setStampActionMessage(`로그인하면 ${selectedPlace.name}에서 바로 현장 스탬프를 찍을 수 있어요.`);
      return;
    }

    if (todayStamp) {
      setStampActionMessage(`${todayStamp.visitLabel} 스탬프를 이미 찍었어요. 오늘 피드와 코스로 바로 이어갈 수 있어요.`);
      return;
    }

    if (typeof selectedPlaceDistanceMeters !== 'number') {
      setStampActionMessage('현재 위치를 확인하면 스탬프 가능 여부를 바로 알려드릴게요.');
      return;
    }

    if (selectedPlaceDistanceMeters <= STAMP_UNLOCK_RADIUS_METERS) {
      setStampActionMessage(`현재 약 ${formatDistanceMeters(selectedPlaceDistanceMeters)} 거리예요. 지금 바로 스탬프를 찍을 수 있어요.`);
      return;
    }

    setStampActionMessage(`현재 약 ${formatDistanceMeters(selectedPlaceDistanceMeters)} 거리예요. ${STAMP_UNLOCK_RADIUS_METERS}m 안으로 들어오면 스탬프가 열려요.`);
  }, [selectedPlace, selectedPlaceDistanceMeters, sessionUser, todayStamp]);

  async function loadApp(withLoading: boolean) {
    const authParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
    const authState = authParams?.get('auth');

    if (withLoading) {
      setBootstrapStatus('loading');
    }
    setBootstrapError(null);

    try {
      const [bootstrap, auth, routes, festivalResult] = await Promise.all([
        getBootstrap(),
        getAuthSession(),
        fetchCommunityRoutes(communityRouteSort, true),
        getFestivals().catch(() => [] as FestivalItem[]),
      ]);

      setPlaces(bootstrap.places);
      setFestivals(festivalResult);
      setReviews(bootstrap.reviews);
      setCourses(bootstrap.courses);
      setStampState(bootstrap.stamps);
      setHasRealData(bootstrap.hasRealData);
      replaceCommunityRoutes(routes, communityRouteSort);
      setSessionUser(auth.user);
      setProviders(auth.providers);
      setSelectedPlaceId((current) => (current && bootstrap.places.some((place) => place.id === current) ? current : null));
      setSelectedFestivalId((current) => (current && festivalResult.some((festival) => festival.id === current) ? current : null));

      if (auth.user) {
        if (activeTab === 'my') {
          await refreshMyPageForUser(auth.user, true);
        }
      } else {
        setMyPage(null);
      }

      setBootstrapStatus('ready');
      if (authState === 'naver-success' && auth.user?.profileCompletedAt === null) {
        goToTab('my');
        setNotice('닉네임을 먼저 저장하면 바로 피드와 코스로 이어갈 수 있어요.');
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
      setMapLocationMessage(`현재 위치를 다시 잡았어요. 예상 오차는 약 ${formatDistanceMeters(nextPosition.accuracyMeters)}예요.`);
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
      setNotice('로그인해야 현장 스탬프를 찍을 수 있어요.');
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
      setReviews((current) => [createdReview, ...current.filter((review) => review.id !== createdReview.id)]);
      await refreshMyPageForUser(sessionUser);
      setNotice('피드를 남겼어요. 같은 여행 흐름으로 코스까지 이어갈 수 있어요.');
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
      setNotice('댓글을 남기려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentSubmittingReviewId(reviewId);
    try {
      const updatedComments = await createComment(reviewId, { body, parentId: parentId ?? null });
      setReviews((current) =>
        current.map((r) =>
          r.id === reviewId ? { ...r, comments: updatedComments, commentCount: updatedComments.length } : r,
        ),
      );
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentSubmittingReviewId(null);
    }
  }

  async function handleToggleReviewLike(reviewId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('좋아요를 누르려면 먼저 로그인해 주세요.');
      return;
    }

    setReviewLikeUpdatingId(reviewId);
    try {
      const result = await toggleReviewLike(reviewId);
      setReviews((current) =>
        current.map((r) =>
          r.id === reviewId ? { ...r, likeCount: result.likeCount, likedByMe: result.likedByMe } : r,
        ),
      );
    } catch (error) {
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
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setRouteLikeUpdatingId(null);
    }
  }

  async function handlePublishRoute(payload: { travelSessionId: string; title: string; description: string; mood: string }) {
    if (!sessionUser) {
      goToTab('my');
      setRouteError('로그인한 뒤에만 여행 세션을 코스로 발행할 수 있어요.');
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
      setNotice('여행 세션을 공개 코스로 발행했어요. 이제 다른 사용자도 이 경로를 볼 수 있어요.');
      setMyPageTab('routes');
    } catch (error) {
      setRouteError(formatErrorMessage(error));
    } finally {
      setRouteSubmitting(false);
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
      setNotice('닉네임을 저장했어요. 이제 메인 흐름으로 바로 이어갈 수 있어요.');
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

  const canNavigateBack = activeCommentReviewId !== null || activeTab !== 'map' || selectedPlaceId !== null || selectedFestivalId !== null || drawerState !== 'closed';

  function handleNavigateBack() {
    if (returnView && activeTab === 'map') {
      setMyPageTab(returnView.myPageTab);
      setActiveCommentReviewId(returnView.activeCommentReviewId);
      setHighlightedCommentId(returnView.highlightedCommentId);
      const nextTab = returnView.tab;
      setReturnView(null);
      commitRouteState({ tab: nextTab, placeId: null, festivalId: null, drawerState: 'closed' }, 'replace');
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

  const reviewProofMessage = !sessionUser
    ? '로그인한 뒤 스탬프를 찍어야 피드를 작성할 수 있어요.'
    : todayStamp
      ? `${todayStamp.visitLabel} 스탬프가 있어요. 지금 이 장소 피드를 바로 남길 수 있어요.`
      : '오늘 스탬프를 찍으면 피드 작성 버튼이 바로 열려요.';

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
            visitCount={visitCount}
            latestStamp={latestStamp}
            todayStamp={todayStamp}
            stampActionStatus={stampActionStatus}
            stampActionMessage={stampActionMessage}
            reviewProofMessage={reviewProofMessage}
            reviewError={reviewError}
            reviewSubmitting={reviewSubmitting}
            reviewLikeUpdatingId={reviewLikeUpdatingId}
            commentSubmittingReviewId={commentSubmittingReviewId}
            canCreateReview={canCreateReview}
            initialMapCenter={{ lat: initialMapViewport.lat, lng: initialMapViewport.lng }}
            initialMapZoom={initialMapViewport.zoom}
            onOpenPlace={openPlace}
            onOpenFestival={openFestival}
            onCloseDrawer={closeDrawer}
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
            onToggleReviewLike={handleToggleReviewLike}
            onCreateComment={handleCreateComment}
            onLocateCurrentPosition={() => void refreshCurrentPosition(true)}
            onMapViewportChange={updateMapViewportInUrl}
          />
        ) : (
          <div className="page-stage">
            {notice && <div className="floating-notice">{notice}</div>}
            {bootstrapStatus === 'loading' && <section className="floating-status">화면을 준비하고 있어요.</section>}
            {bootstrapStatus === 'error' && <section className="floating-status floating-status--error">{bootstrapError}</section>}

            {activeTab === 'feed' && (
              <FeedTab
                reviews={reviews}
                sessionUser={sessionUser}
                reviewLikeUpdatingId={reviewLikeUpdatingId}
                commentSubmittingReviewId={commentSubmittingReviewId}
                activeCommentReviewId={activeCommentReviewId}
                highlightedCommentId={highlightedCommentId}
                onToggleReviewLike={handleToggleReviewLike}
                onCreateComment={handleCreateComment}
                onRequestLogin={() => goToTab('my')}
                onOpenPlace={handleOpenPlaceWithReturn}
                onOpenComments={handleOpenReviewComments}
                onCloseComments={handleCloseReviewComments}
              />
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
                    .catch((error) => setNotice(formatErrorMessage(error)));
                }}
                onToggleLike={handleToggleRouteLike}
                onOpenPlace={handleOpenPlaceWithReturn}
                onRequestLogin={() => goToTab('my')}
              />
            )}

            {activeTab === 'my' && (
              <MyPagePanel
                sessionUser={sessionUser}
                myPage={myPage}
                providers={providers}
                activeTab={myPageTab}
                isLoggingOut={isLoggingOut}
                profileSaving={profileSaving}
                profileError={profileError}
                routeSubmitting={routeSubmitting}
                routeError={routeError}
                onChangeTab={setMyPageTab}
                onLogin={startProviderLogin}
                onLogout={handleLogout}
                onSaveNickname={handleUpdateProfile}
                onPublishRoute={handlePublishRoute}
                onOpenPlace={handleOpenPlaceWithReturn}
                onOpenComment={(reviewId, commentId) => handleOpenReviewComments(reviewId, commentId)}
              />
            )}
          </div>
        )}

        {canNavigateBack && (
          <button type="button" className="app-back-button" onClick={handleNavigateBack} aria-label="이전으로 돌아가기">
            <span aria-hidden="true">←</span>
            <span>이전</span>
          </button>
        )}

        <BottomNav activeTab={activeTab} onChange={goToTab} />
      </div>
    </div>
  );
}








