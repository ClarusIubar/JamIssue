import { useEffect, useMemo, useState } from 'react';
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
  updateReview,
  uploadReviewImage,
} from './api/client';
import { BottomNav } from './components/BottomNav';
import { CourseTab } from './components/CourseTab';
import { FeedTab } from './components/FeedTab';
import { FestivalDetailSheet } from './components/FestivalDetailSheet';
import { MyPagePanel } from './components/MyPagePanel';
import { NaverMap } from './components/NaverMap';
import { PlaceDetailSheet } from './components/PlaceDetailSheet';
import { categoryInfo, categoryItems } from './lib/categories';
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
  DrawerState,
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

const validTabs: Tab[] = ['map', 'feed', 'course', 'my'];
const STAMP_UNLOCK_RADIUS_METERS = 120;

type RouteState = {
  tab: Tab;
  placeId: string | null;
  festivalId: string | null;
  drawerState: DrawerState;
};

function getInitialRouteState(): RouteState {
  if (typeof window === 'undefined') {
    return { tab: 'map', placeId: null, festivalId: null, drawerState: 'closed' };
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const placeId = params.get('place');
  const festivalId = params.get('festival');
  const drawer = params.get('drawer');
  const resolvedTab = tab && validTabs.includes(tab as Tab) ? (tab as Tab) : params.get('auth') ? 'my' : 'map';
  const resolvedDrawer = drawer === 'full' || drawer === 'partial' ? drawer : placeId || festivalId ? 'partial' : 'closed';

  return {
    tab: resolvedTab,
    placeId: placeId || null,
    festivalId: festivalId || null,
    drawerState: resolvedDrawer,
  };
}

function buildRouteUrl(routeState: RouteState) {
  if (typeof window === 'undefined') {
    return '/';
  }

  const params = new URLSearchParams(window.location.search);
  params.set('tab', routeState.tab);

  if (routeState.tab === 'map' && routeState.placeId) {
    params.set('place', routeState.placeId);
    params.delete('festival');
    params.set('drawer', routeState.drawerState === 'closed' ? 'partial' : routeState.drawerState);
  } else if (routeState.tab === 'map' && routeState.festivalId) {
    params.set('festival', routeState.festivalId);
    params.delete('place');
    params.set('drawer', routeState.drawerState === 'closed' ? 'partial' : routeState.drawerState);
  } else {
    params.delete('place');
    params.delete('festival');
    params.delete('drawer');
  }

  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

function getInitialNotice() {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  const reason = params.get('reason');
  if (auth === 'naver-success') {
    return '네이버 로그인을 연결했어요.';
  }
  if (auth === 'naver-linked') {
    return '네이버 계정을 연결했어요.';
  }
  if (auth === 'naver-error') {
    return reason ? `네이버 로그인에 실패했어요. (${reason})` : '네이버 로그인에 실패했어요.';
  }
  return null;
}

function clearAuthQueryParams() {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (!params.has('auth') && !params.has('reason')) {
    return;
  }

  params.delete('auth');
  params.delete('reason');
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

function getLoginReturnUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000/?tab=my';
  }

  return `${window.location.origin}/?tab=my`;
}

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
  const [activeTab, setActiveTab] = useState<Tab>(() => getInitialRouteState().tab);
  const [myPageTab, setMyPageTab] = useState<MyPageTabKey>('stamps');
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [drawerState, setDrawerState] = useState<DrawerState>(() => getInitialRouteState().drawerState);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(() => getInitialRouteState().placeId);
  const [selectedFestivalId, setSelectedFestivalId] = useState<string | null>(() => getInitialRouteState().festivalId);
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
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewEditSubmitting, setReviewEditSubmitting] = useState(false);
  const [reviewEditError, setReviewEditError] = useState<string | null>(null);
  const [stampActionStatus, setStampActionStatus] = useState<ApiStatus>('idle');
  const [stampActionMessage, setStampActionMessage] = useState('장소를 선택하면 오늘 스탬프 가능 여부를 바로 알려드릴게요.');
  const [routeSubmitting, setRouteSubmitting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLikeUpdatingId, setRouteLikeUpdatingId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
  const selectedCategoryCount = filteredPlaces.length;
  const placeNameById = useMemo(() => Object.fromEntries(places.map((place) => [place.id, place.name])), [places]);
  function applyRouteState(routeState: RouteState) {
    setActiveTab(routeState.tab);
    setSelectedPlaceId(routeState.tab === 'map' ? routeState.placeId : null);
    setSelectedFestivalId(routeState.tab === 'map' ? routeState.festivalId : null);
    setDrawerState(routeState.tab === 'map' ? routeState.drawerState : 'closed');
  }
  function commitRouteState(routeState: RouteState, mode: 'push' | 'replace' = 'push') {
    applyRouteState(routeState);
    if (typeof window === 'undefined') {
      return;
    }
    const nextUrl = buildRouteUrl(routeState);
    if (mode === 'replace') {
      window.history.replaceState(routeState, '', nextUrl);
      return;
    }
    window.history.pushState(routeState, '', nextUrl);
  }
  function goToTab(nextTab: Tab, mode: 'push' | 'replace' = 'push') {
    commitRouteState(
      {
        tab: nextTab,
        placeId: null,
        festivalId: null,
        drawerState: 'closed',
      },
      mode,
    );
  }

  useEffect(() => {
    void loadApp(true);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handlePopState = () => {
      applyRouteState(getInitialRouteState());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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
  }, [filteredPlaces, selectedPlaceId]);

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
        getCommunityRoutes(communityRouteSort),
        getFestivals().catch(() => [] as FestivalItem[]),
      ]);

      setPlaces(bootstrap.places);
      setFestivals(festivalResult);
      setReviews(bootstrap.reviews);
      setCourses(bootstrap.courses);
      setStampState(bootstrap.stamps);
      setHasRealData(bootstrap.hasRealData);
      setCommunityRoutes(routes);
      setSessionUser(auth.user);
      setProviders(auth.providers);
      setSelectedPlaceId((current) => (current && bootstrap.places.some((place) => place.id === current) ? current : null));
      setSelectedFestivalId((current) => (current && festivalResult.some((festival) => festival.id === current) ? current : null));

      if (auth.user) {
        setMyPage(await getMySummary());
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

  function openPlace(placeId: string) {
    commitRouteState({
      tab: 'map',
      placeId,
      festivalId: null,
      drawerState: 'partial',
    });
  }
  function openFestival(festivalId: string) {
    commitRouteState({
      tab: 'map',
      placeId: null,
      festivalId,
      drawerState: 'partial',
    });
  }
  function closeDrawer() {
    commitRouteState({
      tab: 'map',
      placeId: null,
      festivalId: null,
      drawerState: 'closed',
    });
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
      commitRouteState({
        tab: 'map',
        placeId: place.id,
        festivalId: null,
        drawerState: 'full',
      }, 'replace');
      setMyPage(await getMySummary());
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

      await createReview({
        placeId: selectedPlace.id,
        stampId: payload.stampId,
        body: payload.body.trim(),
        mood: payload.mood,
        imageUrl,
      });

      setNotice('피드를 남겼어요. 같은 여행 흐름으로 코스까지 이어갈 수 있어요.');
      await loadApp(false);
      if (selectedPlace) {
        commitRouteState({
          tab: 'map',
          placeId: selectedPlace.id,
          festivalId: null,
          drawerState: 'full',
        }, 'replace');
      }
    } catch (error) {
      setReviewError(formatErrorMessage(error));
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleUpdateReview(reviewId: string, payload: { body: string; mood: ReviewMood; file: File | null }) {
    if (!sessionUser) {
      goToTab('my');
      return;
    }

    setReviewEditSubmitting(true);
    setReviewEditError(null);
    try {
      let imageUrl: string | null = null;
      if (payload.file) {
        const uploaded = await uploadReviewImage(payload.file);
        imageUrl = uploaded.url;
      }

      await updateReview(reviewId, {
        body: payload.body.trim(),
        mood: payload.mood,
        imageUrl,
      });

      setEditingReviewId(null);
      setNotice('피드를 수정했어요.');
      await loadApp(false);
    } catch (error) {
      setReviewEditError(formatErrorMessage(error));
    } finally {
      setReviewEditSubmitting(false);
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
      await createComment(reviewId, { body, parentId: parentId ?? null });
      await loadApp(false);
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
      await toggleReviewLike(reviewId);
      await loadApp(false);
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
      await toggleCommunityRouteLike(routeId);
      const nextRoutes = await getCommunityRoutes(communityRouteSort);
      setCommunityRoutes(nextRoutes);
      setMyPage(await getMySummary());
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
      await createUserRoute({
        travelSessionId: payload.travelSessionId,
        title: payload.title,
        description: payload.description,
        mood: payload.mood,
        isPublic: true,
      });
      setNotice('여행 세션을 공개 코스로 발행했어요. 이제 다른 사용자도 이 경로를 볼 수 있어요.');
      await loadApp(false);
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
        setMyPage(await getMySummary());
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
      await logout();
      setSessionUser(null);
      setMyPage(null);
      setNotice('로그아웃했어요.');
      await loadApp(false);
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setIsLoggingOut(false);
    }
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
          <div className="map-stage">
            <header className="map-stage__header">
              <div className="map-stage__brand">
                <p className="eyebrow">DAEJEON JAM ISSUE</p>
                <p className="map-stage__headline">꽃 마커로 장소와 축제를 가볍게 골라보세요.</p>
              </div>
              <div className="map-stage__guide">
                <strong>아래 시트에서 확인</strong>
                <span>마커를 누르면 장소 정보와 스탬프가 바로 열려요.</span>
              </div>
            </header>

            <div className="map-filter-strip">
              <div className="chip-row compact-gap">
                {categoryItems.map((item) => {
                  const isActive = item.key === activeCategory;
                  const info = item.key === 'all' ? null : categoryInfo[item.key];

                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={isActive ? 'chip is-active map-filter-chip' : 'chip map-filter-chip'}
                      onClick={() => setActiveCategory(item.key)}
                      style={
                        info
                          ? {
                              background: isActive ? info.color : 'rgba(255,255,255,0.94)',
                              borderColor: info.jamColor,
                              color: '#4a3140',
                            }
                          : undefined
                      }
                    >
                      {info ? `${info.icon} ${item.label}` : item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {notice && <div className="floating-notice">{notice}</div>}
            {bootstrapStatus === 'loading' && <section className="floating-status">대전 장소와 축제를 불러오고 있어요.</section>}
            {bootstrapStatus === 'error' && <section className="floating-status floating-status--error">{bootstrapError}</section>}


            <NaverMap
              places={filteredPlaces}
              festivals={festivals}
              selectedPlaceId={selectedPlace?.id ?? null}
              selectedFestivalId={selectedFestival?.id ?? null}
              onSelectPlace={openPlace}
              onSelectFestival={openFestival}
              currentPosition={currentPosition}
              currentLocationStatus={mapLocationStatus}
              currentLocationMessage={drawerState === 'closed' ? mapLocationMessage : null}
              focusCurrentLocationKey={mapLocationFocusKey}
              onLocateCurrentPosition={() => void refreshCurrentPosition(true)}
              height="100%"
            />

            {!selectedPlace && !selectedFestival && (
              <section className="map-drawer-teaser">
                <span className="map-drawer-teaser__handle" aria-hidden="true" />
                <div>
                  <strong>아래 시트에서 상세를 확인해요</strong>
                  <p>지도 마커를 누르면 장소 정보, 현장 스탬프, 축제 안내가 아래에서 바로 열립니다.</p>
                </div>
              </section>
            )}

            <PlaceDetailSheet
              place={selectedPlace}
              reviews={selectedPlaceReviews}
              isOpen={Boolean(selectedPlace) && drawerState !== 'closed'}
              drawerState={drawerState}
              loggedIn={Boolean(sessionUser)}
              sessionUserId={sessionUser?.id ?? null}
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
              editingReviewId={editingReviewId}
              reviewEditSubmitting={reviewEditSubmitting}
              reviewEditError={reviewEditError}
              canCreateReview={canCreateReview}
              onClose={closeDrawer}
              onExpand={() => selectedPlace && commitRouteState({ tab: 'map', placeId: selectedPlace.id, festivalId: null, drawerState: 'full' }, 'replace')}
              onCollapse={() => selectedPlace && commitRouteState({ tab: 'map', placeId: selectedPlace.id, festivalId: null, drawerState: 'partial' }, 'replace')}
              onRequestLogin={() => goToTab('my')}
              onClaimStamp={handleClaimStamp}
              onCreateReview={handleCreateReview}
              onToggleReviewLike={handleToggleReviewLike}
              onCreateComment={handleCreateComment}
              onEditReview={(reviewId) => {
                setEditingReviewId(reviewId);
                setReviewEditError(null);
              }}
              onSaveEdit={handleUpdateReview}
              onCancelEdit={() => {
                setEditingReviewId(null);
                setReviewEditError(null);
              }}
            />

            <FestivalDetailSheet
              festival={selectedFestival}
              isOpen={Boolean(selectedFestival) && drawerState !== 'closed'}
              drawerState={drawerState}
              onClose={closeDrawer}
              onExpand={() => selectedFestival && commitRouteState({ tab: 'map', placeId: null, festivalId: selectedFestival.id, drawerState: 'full' }, 'replace')}
              onCollapse={() => selectedFestival && commitRouteState({ tab: 'map', placeId: null, festivalId: selectedFestival.id, drawerState: 'partial' }, 'replace')}
            />
          </div>
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
                editingReviewId={editingReviewId}
                reviewEditSubmitting={reviewEditSubmitting}
                reviewEditError={reviewEditError}
                onToggleReviewLike={handleToggleReviewLike}
                onCreateComment={handleCreateComment}
                onRequestLogin={() => goToTab('my')}
                onOpenPlace={openPlace}
                onEditReview={(reviewId) => {
                  setEditingReviewId(reviewId);
                  setReviewEditError(null);
                }}
                onSaveEdit={handleUpdateReview}
                onCancelEdit={() => {
                  setEditingReviewId(null);
                  setReviewEditError(null);
                }}
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
                  void getCommunityRoutes(sort).then(setCommunityRoutes).catch((error) => setNotice(formatErrorMessage(error)));
                }}
                onToggleLike={handleToggleRouteLike}
                onOpenPlace={openPlace}
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
                editingReviewId={editingReviewId}
                reviewEditSubmitting={reviewEditSubmitting}
                reviewEditError={reviewEditError}
                onChangeTab={setMyPageTab}
                onLogin={startProviderLogin}
                onLogout={handleLogout}
                onSaveNickname={handleUpdateProfile}
                onPublishRoute={handlePublishRoute}
                onOpenPlace={openPlace}
                onEditReview={(reviewId) => {
                  setEditingReviewId(reviewId);
                  setReviewEditError(null);
                }}
                onSaveEdit={handleUpdateReview}
                onCancelEdit={() => {
                  setEditingReviewId(null);
                  setReviewEditError(null);
                }}
              />
            )}
          </div>
        )}

        <BottomNav
          activeTab={activeTab}
          onChange={(nextTab) => {
            goToTab(nextTab);
          }}
        />
      </div>
    </div>
  );
}

















