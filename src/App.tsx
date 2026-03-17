import { useEffect, useMemo, useState } from 'react';
import {
  claimStamp,
  createComment,
  createReview,
  createUserRoute,
  getAuthSession,
  getBootstrap,
  getCommunityRoutes,
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
import { MyPagePanel } from './components/MyPagePanel';
import { NaverMap } from './components/NaverMap';
import { PlaceDetailSheet } from './components/PlaceDetailSheet';
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
const categoryItems: { key: Category; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'landmark', label: '명소' },
  { key: 'food', label: '맛집' },
  { key: 'cafe', label: '카페' },
  { key: 'night', label: '야경' },
];
const STAMP_UNLOCK_RADIUS_METERS = 120;

function getInitialTab(): Tab {
  if (typeof window === 'undefined') {
    return 'map';
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab && validTabs.includes(tab as Tab)) {
    return tab as Tab;
  }

  if (params.get('auth')) {
    return 'my';
  }

  return 'map';
}

function getInitialNotice() {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  const reason = params.get('reason');
  if (auth === 'naver-success') {
    return '네이버 로그인이 연결됐어요.';
  }
  if (auth === 'naver-linked') {
    return '네이버 계정을 현재 계정과 연결했어요.';
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
  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab);
  const [myPageTab, setMyPageTab] = useState<MyPageTabKey>('stamps');
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [drawerState, setDrawerState] = useState<DrawerState>('closed');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(getInitialNotice);
  const [bootstrapStatus, setBootstrapStatus] = useState<ApiStatus>('idle');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
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
  const [stampActionStatus, setStampActionStatus] = useState<ApiStatus>('idle');
  const [stampActionMessage, setStampActionMessage] = useState('마커를 누르면 오늘 스탬프 가능 여부를 바로 보여드릴게요.');
  const [routeSubmitting, setRouteSubmitting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLikeUpdatingId, setRouteLikeUpdatingId] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const filteredPlaces = useMemo(() => filterPlacesByCategory(places, activeCategory), [places, activeCategory]);
  const selectedPlace = useMemo(
    () =>
      filteredPlaces.find((place) => place.id === selectedPlaceId) ??
      places.find((place) => place.id === selectedPlaceId) ??
      filteredPlaces[0] ??
      places[0] ??
      null,
    [filteredPlaces, places, selectedPlaceId],
  );
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

    const timeout = window.setTimeout(() => {
      setNotice(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [notice]);

  useEffect(() => {
    if (!selectedPlace && filteredPlaces[0]) {
      setSelectedPlaceId(filteredPlaces[0].id);
    }
  }, [filteredPlaces, selectedPlace]);

  useEffect(() => {
    if (!selectedPlace) {
      setStampActionMessage('마커를 누르면 오늘 스탬프 가능 여부를 바로 보여드릴게요.');
      return;
    }

    if (!sessionUser) {
      setStampActionMessage(`로그인하면 ${selectedPlace.name}에서 현장 스탬프를 찍을 수 있어요.`);
      return;
    }

    if (todayStamp) {
      setStampActionMessage(`${todayStamp.visitLabel} 스탬프를 이미 찍었어요. 이제 피드 작성 버튼이 열려 있어요.`);
      return;
    }

    if (typeof selectedPlaceDistanceMeters !== 'number') {
      setStampActionMessage('현재 위치를 확인하면 스탬프 가능 여부를 바로 보여드릴게요.');
      return;
    }

    if (selectedPlaceDistanceMeters <= STAMP_UNLOCK_RADIUS_METERS) {
      setStampActionMessage(`현재 약 ${formatDistanceMeters(selectedPlaceDistanceMeters)} 거리예요. 지금 스탬프를 찍을 수 있어요.`);
      return;
    }

    setStampActionMessage(`현재 약 ${formatDistanceMeters(selectedPlaceDistanceMeters)} 거리예요. 반경 ${STAMP_UNLOCK_RADIUS_METERS}m 안에 들어오면 스탬프를 찍을 수 있어요.`);
  }, [selectedPlace, selectedPlaceDistanceMeters, sessionUser, todayStamp]);

  async function loadApp(withLoading: boolean) {
    const authParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
    const authState = authParams?.get('auth');

    if (withLoading) {
      setBootstrapStatus('loading');
    }
    setBootstrapError(null);

    try {
      const [bootstrap, auth, routes] = await Promise.all([
        getBootstrap(),
        getAuthSession(),
        getCommunityRoutes(communityRouteSort),
      ]);

      setPlaces(bootstrap.places);
      setReviews(bootstrap.reviews);
      setCourses(bootstrap.courses);
      setStampState(bootstrap.stamps);
      setHasRealData(bootstrap.hasRealData);
      setCommunityRoutes(routes);
      setSessionUser(auth.user);
      setProviders(auth.providers);
      setSelectedPlaceId((current) => current ?? bootstrap.places[0]?.id ?? null);

      if (auth.user) {
        setMyPage(await getMySummary());
      } else {
        setMyPage(null);
      }

      setBootstrapStatus('ready');
      if (authState === 'naver-success' && auth.user?.profileCompletedAt === null) {
        setActiveTab('my');
        setNotice('로그인은 완료됐어요. 닉네임을 정하면 바로 기록을 이어갈 수 있어요.');
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

  function openPlace(placeId: string) {
    setActiveTab('map');
    setSelectedPlaceId(placeId);
    setDrawerState('partial');
  }

  function closeDrawer() {
    setDrawerState('closed');
    setSelectedPlaceId(null);
  }

  function startProviderLogin(provider: 'naver' | 'kakao') {
    window.location.assign(getProviderLoginUrl(provider, getLoginReturnUrl()));
  }

  async function handleClaimStamp(place: Place) {
    if (!sessionUser) {
      setActiveTab('my');
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
      setNotice(`${place.name} 스탬프를 기록했어요.`);
      setDrawerState('full');
      setMyPage(await getMySummary());
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setStampActionStatus('ready');
    }
  }

  async function handleCreateReview(payload: { stampId: string; body: string; mood: ReviewMood; file: File | null }) {
    if (!sessionUser || !selectedPlace) {
      setActiveTab('my');
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

      setNotice('피드를 올렸어요. 오늘 방문 기록에 바로 반영됐어요.');
      await loadApp(false);
      setDrawerState('full');
    } catch (error) {
      setReviewError(formatErrorMessage(error));
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleCreateComment(reviewId: string, body: string, parentId?: string) {
    if (!sessionUser) {
      setActiveTab('my');
      setNotice('댓글은 로그인 후에만 남길 수 있어요.');
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
      setActiveTab('my');
      setNotice('좋아요는 로그인 후에만 누를 수 있어요.');
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
      setActiveTab('my');
      setNotice('좋아요는 로그인 후에만 누를 수 있어요.');
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
      setActiveTab('my');
      setRouteError('로그인 후에만 코스를 발행할 수 있어요.');
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
      setNotice('여행 세션을 코스로 발행했어요. 이제 좋아요순과 최신순 목록에 올라가요.');
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
      setProfileError('닉네임은 두 글자 이상으로 적어 주세요.');
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
      setNotice('닉네임을 저장했어요. 이제 스탬프와 피드를 이어볼 수 있어요.');
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
    ? '로그인하고 현장 스탬프를 찍으면 이 장소의 피드를 바로 남길 수 있어요.'
    : todayStamp
      ? `${todayStamp.visitLabel} 스탬프를 찍었어요. 지금 바로 피드를 작성할 수 있어요.`
      : '현장 반경 안에서 오늘 스탬프를 먼저 찍어야 후기 버튼이 열려요.';

  return (
    <div className="map-app-shell">
      <div className="phone-shell phone-shell--map">
        <div className="map-stage">
          <NaverMap
            places={filteredPlaces}
            selectedPlaceId={selectedPlace?.id ?? null}
            onSelectPlace={openPlace}
            currentPosition={currentPosition}
            currentLocationStatus={mapLocationStatus}
            currentLocationMessage={mapLocationMessage}
            focusCurrentLocationKey={mapLocationFocusKey}
            onLocateCurrentPosition={() => void refreshCurrentPosition(true)}
            height="100%"
          />

          <div className="map-stage__gradient" />
          <header className="map-stage__header">
            <div>
              <p className="eyebrow">DAEJEON JAM ISSUE</p>
              <h1>지도로 찾고, 스탬프로 남기고, 피드와 코스로 이어가는 대전 탐험</h1>
            </div>
            <button type="button" className="secondary-button map-stage__location-button" onClick={() => void refreshCurrentPosition(true)}>
              {currentPosition ? '내 위치 보기' : '내 위치 켜기'}
            </button>
          </header>

          {notice && <div className="floating-notice">{notice}</div>}
          {bootstrapStatus === 'loading' && <section className="floating-status">데이터를 불러오는 중이에요.</section>}
          {bootstrapStatus === 'error' && <section className="floating-status floating-status--error">{bootstrapError}</section>}
          {!hasRealData && bootstrapStatus === 'ready' && <section className="floating-status">아직 공개 장소 데이터가 충분하지 않아요.</section>}

          {activeTab === 'map' && (
            <div className="map-filter-strip">
              <div className="chip-row compact-gap">
                {categoryItems.map((item) => (
                  <button key={item.key} type="button" className={item.key === activeCategory ? 'chip is-active' : 'chip'} onClick={() => setActiveCategory(item.key)}>
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="counter-pill">{selectedCategoryCount}곳</span>
            </div>
          )}

          {activeTab === 'feed' && (
            <FeedTab
              reviews={reviews}
              sessionUser={sessionUser}
              reviewLikeUpdatingId={reviewLikeUpdatingId}
              commentSubmittingReviewId={commentSubmittingReviewId}
              onToggleReviewLike={handleToggleReviewLike}
              onCreateComment={handleCreateComment}
              onRequestLogin={() => setActiveTab('my')}
              onOpenPlace={openPlace}
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
              onRequestLogin={() => setActiveTab('my')}
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
              onOpenPlace={openPlace}
            />
          )}

          {activeTab === 'map' && (
            <PlaceDetailSheet
              place={selectedPlace}
              reviews={selectedPlaceReviews}
              isOpen={Boolean(selectedPlace) && drawerState !== 'closed'}
              drawerState={drawerState}
              loggedIn={Boolean(sessionUser)}
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
              onClose={closeDrawer}
              onExpand={() => setDrawerState('full')}
              onCollapse={() => setDrawerState('partial')}
              onRequestLogin={() => setActiveTab('my')}
              onClaimStamp={handleClaimStamp}
              onCreateReview={handleCreateReview}
              onToggleReviewLike={handleToggleReviewLike}
              onCreateComment={handleCreateComment}
            />
          )}
        </div>

        <BottomNav
          activeTab={activeTab}
          onChange={(nextTab) => {
            setActiveTab(nextTab);
            if (nextTab !== 'map') {
              setDrawerState('closed');
            }
          }}
        />
      </div>
    </div>
  );
}


