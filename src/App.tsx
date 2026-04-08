import { useCallback, useState } from 'react';
import {
  getAuthSession,
} from './api/client';
import { AppMapStageView } from './components/AppMapStageView';
import { AppPageStage } from './components/AppPageStage';
import { BottomNav } from './components/BottomNav';
import { GlobalFeedbackButton } from './components/GlobalFeedbackButton';
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
import { useAppAdminActions } from './hooks/useAppAdminActions';
import { useAppFeedbackEffects } from './hooks/useAppFeedbackEffects';
import { useAppMapActions } from './hooks/useAppMapActions';
import { useAppNavigationHelpers } from './hooks/useAppNavigationHelpers';
import { useNotificationLifecycle } from './hooks/useNotificationLifecycle';
import { useAppReviewActions } from './hooks/useAppReviewActions';
import { useAppRouteActions } from './hooks/useAppRouteActions';
import { useAppShellNavigation } from './hooks/useAppShellNavigation';
import { useAppTabDataLoaders } from './hooks/useAppTabDataLoaders';
import { useAppViewModels } from './hooks/useAppViewModels';
import { useActiveReviewComments } from './hooks/useActiveReviewComments';
import { useNotificationActions } from './hooks/useNotificationActions';
import { useAppStageActions } from './hooks/useAppStageActions';
import { useAppPagePaginationActions } from './hooks/useAppPagePaginationActions';
import { useAppPageStageActions } from './hooks/useAppPageStageActions';
import { useAppUIStore } from './store/app-ui-store';
import { useMyPageStore } from './store/my-page-store';
import { useNotificationStore } from './store/notification-store';
import { useReviewUIStore } from './store/review-ui-store';
import type {
  ApiStatus,
  Category,
  Comment,
  Tab,
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

  const myPageTab = useMyPageStore((state) => state.myPageTab);
  const setMyPageTab = useMyPageStore((state) => state.setMyPageTab);
  const feedPlaceFilterId = useReviewUIStore((state) => state.feedPlaceFilterId);
  const setFeedPlaceFilterId = useReviewUIStore((state) => state.setFeedPlaceFilterId);
  const activeCategory = useAppUIStore((state) => state.activeCategory);
  const setActiveCategory = useAppUIStore((state) => state.setActiveCategory);
  const activeCommentReviewId = useReviewUIStore((state) => state.activeCommentReviewId);
  const setActiveCommentReviewId = useReviewUIStore((state) => state.setActiveCommentReviewId);
  const highlightedCommentId = useReviewUIStore((state) => state.highlightedCommentId);
  const setHighlightedCommentId = useReviewUIStore((state) => state.setHighlightedCommentId);
  const highlightedReviewId = useReviewUIStore((state) => state.highlightedReviewId);
  const setHighlightedReviewId = useReviewUIStore((state) => state.setHighlightedReviewId);
  const selectedRoutePreview = useAppUIStore((state) => state.selectedRoutePreview);
  const setSelectedRoutePreview = useAppUIStore((state) => state.setSelectedRoutePreview);
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

  const {
    loadMoreFeedReviews,
    loadMoreMyComments,
  } = useAppPagePaginationActions({
    sessionUser,
    myPage,
    feedNextCursor,
    feedHasMore,
    feedLoadingMore,
    myCommentsNextCursor,
    myCommentsHasMore,
    myCommentsLoadingMore,
    setReviews,
    setMyPage,
    setFeedNextCursor,
    setFeedHasMore,
    setFeedLoadingMore,
    setMyCommentsNextCursor,
    setMyCommentsHasMore,
    setMyCommentsLoadingMore,
    setMyCommentsLoadedOnce,
    reportBackgroundError,
  });

  const {
    activeReviewComments,
    activeReviewCommentsStatus,
    syncReviewComments,
    clearReviewComments,
  } = useActiveReviewComments({
    activeCommentReviewId,
    setNotice,
    formatErrorMessage,
  });

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
    setPlaces,
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
    syncReviewComments,
    clearReviewComments,
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

  const {
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    handleDeleteNotification,
    handleOpenGlobalNotification,
  } = useNotificationActions({
    markNotificationReadInStore,
    markAllNotificationsReadInStore,
    deleteNotificationInStore,
    handleOpenCommentWithReturn,
    handleOpenReviewWithReturn,
    goToTab,
    setMyPageTab,
  });

  const {
    handleToggleAdminPlace,
    handleToggleAdminManualOverride,
    handleRefreshAdminImport,
  } = useAppAdminActions({
    sessionUser,
    setAdminBusyPlaceId,
    setAdminSummary,
    setPlaces,
    setStampState,
    setHasRealData,
    setNotice,
    setAdminLoading,
    setFestivals,
    refreshAdminSummary,
    formatErrorMessage,
  });

  const { canNavigateBack, handleNavigateBack, handleBottomNavChange } = useAppShellNavigation({
    sessionUser,
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

  const {
    handleMapOpenPlaceFeed,
    handleMapOpenPlace,
    handleMapOpenFestival,
    handleMapOpenRoutePreviewPlace,
    handleClearRoutePreview,
    handleExpandPlaceDrawer,
    handleCollapsePlaceDrawer,
    handleExpandFestivalDrawer,
    handleCollapseFestivalDrawer,
    handleRequestLogin,
    handleLocateCurrentPosition,
  } = useAppStageActions({
    selectedPlace,
    selectedFestival,
    selectedPlaceId,
    selectedFestivalId,
    drawerState,
    selectedRoutePreview,
    setSelectedRoutePreview,
    commitRouteState,
    goToTab,
    handleOpenPlaceFeedWithReturn,
    refreshCurrentPosition,
  });

  const {
    handleClearPlaceFilter,
    handleChangeRouteSort,
    handleRetryMyPage,
    handleOpenCommentFromMyPage,
  } = useAppPageStageActions({
    sessionUser,
    setFeedPlaceFilterId,
    setCommunityRouteSort,
    handleOpenCommentWithReturn,
    fetchCommunityRoutes,
    refreshMyPageForUser,
    reportBackgroundError,
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
        <div className="phone-shell__utility-slot">
          <GlobalFeedbackButton />
          {sessionUser && hydratedMyPage && (
            <GlobalNotificationCenter
              sessionUserName={sessionUser.nickname}
              notifications={hydratedMyPage.notifications}
              unreadCount={hydratedMyPage.unreadNotificationCount}
              onOpenNotification={handleOpenGlobalNotification}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              onDeleteNotification={handleDeleteNotification}
            />
          )}
        </div>
        <div className="phone-shell__body">
          {activeTab === 'map' ? (
            <AppMapStageView
              mapData={{
                activeCategory,
                filteredPlaces,
                festivals,
                selectedPlace,
                selectedFestival,
                currentPosition,
                mapLocationStatus,
                mapLocationFocusKey,
                drawerState,
                sessionUser,
                selectedPlaceReviews,
                routePreview: selectedRoutePreview,
                routePreviewPlaces,
                visitCount,
                latestStamp,
                todayStamp,
                stampActionStatus,
                stampActionMessage,
                reviewProofMessage,
                reviewError,
                reviewSubmitting,
                canCreateReview,
                hasCreatedReviewToday,
                initialMapViewport,
              }}
              mapActions={{
                setActiveCategory,
                onOpenPlaceFeed: handleMapOpenPlaceFeed,
                onOpenPlace: handleMapOpenPlace,
                onOpenRoutePreviewPlace: handleMapOpenRoutePreviewPlace,
                onOpenFestival: handleMapOpenFestival,
                onCloseDrawer: closeDrawer,
                onClearRoutePreview: handleClearRoutePreview,
                onExpandPlaceDrawer: handleExpandPlaceDrawer,
                onCollapsePlaceDrawer: handleCollapsePlaceDrawer,
                onExpandFestivalDrawer: handleExpandFestivalDrawer,
                onCollapseFestivalDrawer: handleCollapseFestivalDrawer,
                onRequestLogin: handleRequestLogin,
                onClaimStamp: handleClaimStamp,
                onCreateReview: handleCreateReview,
                onLocateCurrentPosition: handleLocateCurrentPosition,
                onMapViewportChange: updateMapViewportInUrl,
              }}
            />
          ) : (
            <AppPageStage
              activeTab={activeTab}
              sharedData={{
                sessionUser,
                placeNameById,
                festivals,
              }}
              feedData={{
                reviews,
                reviewLikeUpdatingId,
                feedPlaceFilterId,
                commentSubmittingReviewId,
                commentMutatingId,
                deletingReviewId,
                activeCommentReviewId,
                activeCommentReviewComments: activeReviewComments,
                activeCommentReviewStatus: activeReviewCommentsStatus,
                highlightedCommentId,
                highlightedReviewId,
                feedHasMore,
                feedLoadingMore,
              }}
              courseData={{
                courses,
                communityRoutes,
                communityRouteSort,
                routeLikeUpdatingId,
              }}
              myPageData={{
                myPage: hydratedMyPage,
                providers,
                myPageError,
                myPageTab,
                isLoggingOut,
                profileSaving,
                profileError,
                routeSubmitting,
                routeError,
                adminSummary,
                adminBusyPlaceId,
                adminLoading,
                commentsHasMore: myCommentsHasMore,
                commentsLoadingMore: myCommentsLoadingMore,
              }}
              sharedActions={{
                onRequestLogin: handleRequestLogin,
                onOpenPlace: handleOpenPlaceWithReturn,
              }}
              feedActions={{
                onLoadMoreFeed: loadMoreFeedReviews,
                onToggleReviewLike: handleToggleReviewLike,
                onCreateComment: handleCreateComment,
                onUpdateComment: handleUpdateComment,
                onDeleteComment: handleDeleteComment,
                onDeleteReview: handleDeleteReview,
                onClearPlaceFilter: handleClearPlaceFilter,
                onOpenComments: handleOpenReviewComments,
                onCloseComments: handleCloseReviewComments,
              }}
              courseActions={{
                onChangeRouteSort: handleChangeRouteSort,
                onToggleRouteLike: handleToggleRouteLike,
                onOpenRoutePreview: handleOpenRoutePreview,
              }}
              myPageActions={{
                onChangeMyPageTab: setMyPageTab,
                onLogin: startProviderLogin,
                onRetryMyPage: handleRetryMyPage,
                onLogout: handleLogout,
                onSaveNickname: handleUpdateProfile,
                onPublishRoute: handlePublishRoute,
                onOpenCommentFromMyPage: handleOpenCommentFromMyPage,
                onOpenReview: handleOpenReviewWithReturn,
                onUpdateReview: handleUpdateReview,
                onDeleteReview: handleDeleteReview,
                onMarkNotificationRead: handleMarkNotificationRead,
                onMarkAllNotificationsRead: handleMarkAllNotificationsRead,
                onDeleteNotification: handleDeleteNotification,
                onLoadMoreComments: loadMoreMyComments,
                onRefreshAdmin: handleRefreshAdminImport,
                onToggleAdminPlace: handleToggleAdminPlace,
                onToggleAdminManualOverride: handleToggleAdminManualOverride,
              }}
            />
          )}

          {canNavigateBack && <FloatingBackButton onNavigateBack={handleNavigateBack} />}

          <BottomNav activeTab={activeTab} onChange={handleBottomNavChange} />
        </div>
      </div>
    </div>
  );
}
