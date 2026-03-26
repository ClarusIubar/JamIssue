import { useEffect, useState } from 'react';
import {
  getAuthSession,
  getMyCommentsPage,
  getReviewFeedPage,
} from './api/client';
import { AppMapStageView } from './components/AppMapStageView';
import { AppPageStage } from './components/AppPageStage';
import { BottomNav } from './components/BottomNav';
import { FloatingBackButton } from './components/FloatingBackButton';
import { GlobalNotificationCenter } from './components/GlobalNotificationCenter';
import { GlobalStatusBanner } from './components/GlobalStatusBanner';
import {
  useAppRouteState,
  getInitialNotice,
  getInitialMapViewport,
  updateMapViewportInUrl,
} from './hooks/useAppRouteState';
import { useAppDataState } from './hooks/useAppDataState';
import { useAppBootstrapLifecycle } from './hooks/useAppBootstrapLifecycle';
import { useAppAuthActions } from './hooks/useAppAuthActions';
import { useAppFeedbackEffects } from './hooks/useAppFeedbackEffects';
import { useAppMapActions } from './hooks/useAppMapActions';
import { useAppNavigationHelpers } from './hooks/useAppNavigationHelpers';
import { useNotificationLifecycle } from './hooks/useNotificationLifecycle';
import { useAppReviewActions } from './hooks/useAppReviewActions';
import { useAppRouteActions } from './hooks/useAppRouteActions';
import { useAppShellNavigation } from './hooks/useAppShellNavigation';
import { useAppTabDataLoaders } from './hooks/useAppTabDataLoaders';
import { useAppViewModels } from './hooks/useAppViewModels';
import { useAppUIStore } from './store/app-ui-store';
import { useNotificationStore } from './store/notification-store';
import type {
  ApiStatus,
  Category,
  Tab,
  UserNotification,
} from './types';

const STAMP_UNLOCK_RADIUS_METERS = 120;
const NOTICE_DISMISS_DELAY_MS = 4000;

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '\uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694. \uC7A0\uC2DC \uB4A4\uC5D0 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.';
}

function reportBackgroundError(error: unknown) {
  console.error(error);
}

export default function App() {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadNotificationCount = useNotificationStore((state) => state.unreadCount);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const connectNotifications = useNotificationStore((state) => state.connect);
  const disconnectNotifications = useNotificationStore((state) => state.disconnect);
  const hydrateNotifications = useNotificationStore((state) => state.hydrate);
  const markNotificationReadInStore = useNotificationStore((state) => state.markRead);
  const markAllNotificationsReadInStore = useNotificationStore((state) => state.markAllRead);
  const deleteNotificationInStore = useNotificationStore((state) => state.deleteNotification);
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

  const myPageTab = useAppUIStore((state) => state.myPageTab);
  const setMyPageTab = useAppUIStore((state) => state.setMyPageTab);
  const feedPlaceFilterId = useAppUIStore((state) => state.feedPlaceFilterId);
  const setFeedPlaceFilterId = useAppUIStore((state) => state.setFeedPlaceFilterId);
  const activeCategory = useAppUIStore((state) => state.activeCategory);
  const setActiveCategory = useAppUIStore((state) => state.setActiveCategory);
  const activeCommentReviewId = useAppUIStore((state) => state.activeCommentReviewId);
  const setActiveCommentReviewId = useAppUIStore((state) => state.setActiveCommentReviewId);
  const highlightedCommentId = useAppUIStore((state) => state.highlightedCommentId);
  const setHighlightedCommentId = useAppUIStore((state) => state.setHighlightedCommentId);
  const highlightedReviewId = useAppUIStore((state) => state.highlightedReviewId);
  const setHighlightedReviewId = useAppUIStore((state) => state.setHighlightedReviewId);
  const returnView = useAppUIStore((state) => state.returnView);
  const setReturnView = useAppUIStore((state) => state.setReturnView);
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

  const {
    filteredPlaces,
    hydratedMyPage,
    selectedPlace,
    routePreviewPlaces,
    selectedFestival,
    todayStamp,
    latestStamp,
    visitCount,
    selectedPlaceDistanceMeters,
    hasCreatedReviewToday,
    canCreateReview,
    placeNameById,
    globalStatus,
    reviewProofMessage,
  } = useAppViewModels({
    places,
    festivals,
    reviews,
    selectedPlaceReviews,
    selectedPlaceId,
    selectedFestivalId,
    selectedRoutePreview,
    activeCategory,
    myPage,
    notifications,
    unreadNotificationCount,
    stampState,
    currentPosition,
    sessionUser,
    notice,
    bootstrapStatus,
    bootstrapError,
    mapLocationStatus,
    mapLocationMessage,
  });
  const {
    startProviderLogin,
    handleUpdateProfile,
    handleLogout,
  } = useAppAuthActions({
    setSessionUser,
    setProviders,
    setMyPage,
    setNotice,
    setIsLoggingOut,
    setProfileSaving,
    setProfileError,
    formatErrorMessage,
  });


  useNotificationLifecycle({
    sessionUser,
    myPage,
    fetchNotifications,
    connectNotifications,
    disconnectNotifications,
    hydrateNotifications,
  });
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

  const {
    handleOpenReviewComments,
    handleCloseReviewComments,
    handleOpenRoutePreview,
    handleOpenPlaceWithReturn,
    handleOpenFestivalWithReturn,
    handleOpenReviewWithReturn,
    handleOpenPlaceFeedWithReturn,
    handleOpenCommentWithReturn,
  } = useAppNavigationHelpers({
    activeTab,
    myPageTab,
    activeCommentReviewId,
    highlightedCommentId,
    highlightedReviewId,
    selectedPlaceId,
    selectedFestivalId,
    drawerState,
    feedPlaceFilterId,
    reviews,
    selectedPlaceReviews,
    myPageReviews: myPage?.reviews ?? [],
    setActiveCommentReviewId,
    setHighlightedCommentId,
    setHighlightedReviewId,
    setReturnView,
    setSelectedRoutePreview,
    setFeedPlaceFilterId,
    setNotice,
    goToTab,
    commitRouteState,
    openPlace,
    openFestival,
    upsertReviewCollections,
  });

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
  useAppFeedbackEffects({
    selectedPlace,
    selectedPlaceDistanceMeters,
    sessionUser,
    todayStamp,
    notice,
    mapLocationMessage,
    stampUnlockRadiusMeters: STAMP_UNLOCK_RADIUS_METERS,
    noticeDismissDelayMs: NOTICE_DISMISS_DELAY_MS,
    setStampActionMessage,
    setNotice,
    setMapLocationMessage,
  });


  useAppBootstrapLifecycle({
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
  });

  const {
    refreshCurrentPosition,
    handleClaimStamp,
  } = useAppMapActions({
    sessionUser,
    setCurrentPosition,
    setMapLocationStatus,
    setMapLocationMessage,
    setMapLocationFocusKey,
    setNotice,
    setStampState,
    setStampActionStatus,
    goToTab,
    commitRouteState,
    refreshMyPageForUser,
    formatErrorMessage,
  });

  const {
    handleCreateReview,
    handleUpdateReview,
    handleCreateComment,
    handleUpdateComment,
    handleDeleteComment,
    handleDeleteReview,
    handleToggleReviewLike,
  } = useAppReviewActions({
    activeTab,
    sessionUser,
    selectedPlace,
    reviews,
    selectedPlaceReviews,
    myPage,
    activeCommentReviewId,
    highlightedReviewId,
    setReviewSubmitting,
    setReviewError,
    setCommentSubmittingReviewId,
    setCommentMutatingId,
    setDeletingReviewId,
    setReviewLikeUpdatingId,
    setSelectedPlaceReviews,
    setReviews,
    setMyPage,
    setNotice,
    setHighlightedReviewId,
    goToTab,
    commitRouteState,
    refreshMyPageForUser,
    patchReviewCollections,
    upsertReviewCollections,
    placeReviewsCacheRef,
    handleCloseReviewComments,
    formatErrorMessage,
  });


  const {
    handleToggleRouteLike,
    handlePublishRoute,
  } = useAppRouteActions({
    sessionUser,
    setRouteLikeUpdatingId,
    setRouteSubmitting,
    setRouteError,
    setMyPage,
    setNotice,
    setMyPageTab,
    communityRoutesCacheRef,
    patchCommunityRoutes,
    refreshMyPageForUser,
    formatErrorMessage,
    goToTab,
  });

  async function handleMarkNotificationRead(notificationId: string) {
    await markNotificationReadInStore(notificationId);
  }

  async function handleMarkAllNotificationsRead() {
    await markAllNotificationsReadInStore();
  }

  async function handleDeleteNotification(notificationId: string) {
    await deleteNotificationInStore(notificationId);
  }

  async function handleOpenGlobalNotification(notification: UserNotification) {
    if (!notification.isRead) {
      await handleMarkNotificationRead(notification.id);
    }

    if (notification.reviewId && notification.commentId) {
      handleOpenCommentWithReturn(notification.reviewId, notification.commentId);
      return;
    }
    if (notification.reviewId) {
      handleOpenReviewWithReturn(notification.reviewId);
      return;
    }
    if (notification.routeId) {
      goToTab('my');
      setMyPageTab('routes');
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

  const { canNavigateBack, handleNavigateBack, handleBottomNavChange } = useAppShellNavigation({
    returnView,
    activeCommentReviewId,
    activeTab,
    selectedPlaceId,
    selectedFestivalId,
    drawerState,
    selectedRoutePreview,
    setMyPageTab,
    setActiveCommentReviewId,
    setHighlightedCommentId,
    setHighlightedReviewId,
    setFeedPlaceFilterId,
    setSelectedRoutePreview,
    setReturnView,
    handleCloseReviewComments,
    goToTab,
    commitRouteState,
  });

  return (
    <div className="map-app-shell">
      <div className={[
        'phone-shell',
        activeTab === 'map' ? 'phone-shell--map' : '',
      ].filter(Boolean).join(' ')}>
        {globalStatus && (
          <div className="phone-shell__status-slot">
            <GlobalStatusBanner tone={globalStatus.tone} message={globalStatus.message} layout={activeTab === 'map' ? 'map' : 'page'} />
          </div>
        )}
        {sessionUser && hydratedMyPage && (
          <div className="phone-shell__utility-slot">
            <GlobalNotificationCenter
              sessionUserName={sessionUser.nickname}
              notifications={hydratedMyPage.notifications}
              unreadCount={hydratedMyPage.unreadNotificationCount}
              onOpenNotification={handleOpenGlobalNotification}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              onDeleteNotification={handleDeleteNotification}
            />
          </div>
        )}
        <div className="phone-shell__body">
          {activeTab === 'map' ? (
            <AppMapStageView
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
              initialMapViewport={{ lat: initialMapViewport.lat, lng: initialMapViewport.lng, zoom: initialMapViewport.zoom }}
              onOpenPlaceFeed={() => {
                if (!selectedPlace) {
                  return;
                }
                handleOpenPlaceFeedWithReturn(selectedPlace.id);
              }}
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
            <AppPageStage
              activeTab={activeTab}
              reviews={reviews}
              sessionUser={sessionUser}
              reviewLikeUpdatingId={reviewLikeUpdatingId}
              feedPlaceFilterId={feedPlaceFilterId}
              placeNameById={placeNameById}
              commentSubmittingReviewId={commentSubmittingReviewId}
              commentMutatingId={commentMutatingId}
              deletingReviewId={deletingReviewId}
              activeCommentReviewId={activeCommentReviewId}
              highlightedCommentId={highlightedCommentId}
              highlightedReviewId={highlightedReviewId}
              feedHasMore={feedHasMore}
              feedLoadingMore={feedLoadingMore}
              festivals={festivals}
              courses={courses}
              communityRoutes={communityRoutes}
              communityRouteSort={communityRouteSort}
              routeLikeUpdatingId={routeLikeUpdatingId}
              myPage={hydratedMyPage}
              providers={providers}
              myPageError={myPageError}
              myPageTab={myPageTab}
              isLoggingOut={isLoggingOut}
              profileSaving={profileSaving}
              profileError={profileError}
              routeSubmitting={routeSubmitting}
              routeError={routeError}
              adminSummary={adminSummary}
              adminBusyPlaceId={adminBusyPlaceId}
              adminLoading={adminLoading}
              commentsHasMore={myCommentsHasMore}
              commentsLoadingMore={myCommentsLoadingMore}
              onLoadMoreFeed={loadMoreFeedReviews}
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
              onChangeRouteSort={(sort) => {
                setCommunityRouteSort(sort);
                void fetchCommunityRoutes(sort).catch(reportBackgroundError);
              }}
              onToggleRouteLike={handleToggleRouteLike}
              onOpenRoutePreview={handleOpenRoutePreview}
              onChangeMyPageTab={setMyPageTab}
              onLogin={startProviderLogin}
              onRetryMyPage={async () => { if (sessionUser) { await refreshMyPageForUser(sessionUser, true); } }}
              onLogout={handleLogout}
              onSaveNickname={handleUpdateProfile}
              onPublishRoute={handlePublishRoute}
              onOpenCommentFromMyPage={(reviewId, commentId) => handleOpenCommentWithReturn(reviewId, commentId)}
              onOpenReview={handleOpenReviewWithReturn}
              onUpdateReview={handleUpdateReview}
              onMarkNotificationRead={handleMarkNotificationRead}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              onDeleteNotification={handleDeleteNotification}
              onLoadMoreComments={loadMoreMyComments}
              onRefreshAdmin={handleRefreshAdminImport}
              onToggleAdminPlace={handleToggleAdminPlace}
              onToggleAdminManualOverride={handleToggleAdminManualOverride}
            />
          )}

          {canNavigateBack && <FloatingBackButton onNavigateBack={handleNavigateBack} />}

          <BottomNav activeTab={activeTab} onChange={handleBottomNavChange} />
        </div>
      </div>
    </div>
  );
}



