import { useCallback, useEffect, useState } from 'react';
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
import { useGlobalNotifications } from './hooks/useGlobalNotifications';
import { useAppMapActions } from './hooks/useAppMapActions';
import { useAppNavigationHelpers } from './hooks/useAppNavigationHelpers';
import { useAppReviewActions } from './hooks/useAppReviewActions';
import { useAppRouteActions } from './hooks/useAppRouteActions';
import { useAppShellNavigation } from './hooks/useAppShellNavigation';
import { useAppTabDataLoaders } from './hooks/useAppTabDataLoaders';
import { useAppViewModels } from './hooks/useAppViewModels';
import { useActiveReviewComments } from './hooks/useActiveReviewComments';
import { useAppStageActions } from './hooks/useAppStageActions';
import { useAppPagePaginationActions } from './hooks/useAppPagePaginationActions';
import { useAppPageStageActions } from './hooks/useAppPageStageActions';
import { useAppMapStore } from './store/app-map-store';
import { useAuthStore } from './store/auth-store';
import { useAppPageRuntimeStore } from './store/app-page-runtime-store';
import { useAppShellRuntimeStore } from './store/app-shell-runtime-store';
import { useAppUIStore } from './store/app-ui-store';
import { useMyPageStore } from './store/my-page-store';
import { useReviewUIStore } from './store/review-ui-store';
import type { Tab } from './types';

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
  const {
    activeTab,
    drawerState,
    selectedPlaceId,
    selectedFestivalId,
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
  const activeCategory = useAppMapStore((state) => state.activeCategory);
  const setActiveCategory = useAppMapStore((state) => state.setActiveCategory);
  const activeCommentReviewId = useReviewUIStore((state) => state.activeCommentReviewId);
  const setActiveCommentReviewId = useReviewUIStore((state) => state.setActiveCommentReviewId);
  const highlightedCommentId = useReviewUIStore((state) => state.highlightedCommentId);
  const setHighlightedCommentId = useReviewUIStore((state) => state.setHighlightedCommentId);
  const highlightedReviewId = useReviewUIStore((state) => state.highlightedReviewId);
  const setHighlightedReviewId = useReviewUIStore((state) => state.setHighlightedReviewId);
  const highlightedRouteId = useReviewUIStore((state) => state.highlightedRouteId);
  const setHighlightedRouteId = useReviewUIStore((state) => state.setHighlightedRouteId);
  const selectedRoutePreview = useAppMapStore((state) => state.selectedRoutePreview);
  const setSelectedRoutePreview = useAppMapStore((state) => state.setSelectedRoutePreview);
  const returnView = useAppUIStore((state) => state.returnView);
  const setReturnView = useAppUIStore((state) => state.setReturnView);
  const notice = useAppShellRuntimeStore((state) => state.notice);
  const setNotice = useAppShellRuntimeStore((state) => state.setNotice);
  const currentPosition = useAppShellRuntimeStore((state) => state.currentPosition);
  const setCurrentPosition = useAppShellRuntimeStore((state) => state.setCurrentPosition);
  const mapLocationStatus = useAppShellRuntimeStore((state) => state.mapLocationStatus);
  const setMapLocationStatus = useAppShellRuntimeStore((state) => state.setMapLocationStatus);
  const mapLocationMessage = useAppShellRuntimeStore((state) => state.mapLocationMessage);
  const setMapLocationMessage = useAppShellRuntimeStore((state) => state.setMapLocationMessage);
  const mapLocationFocusKey = useAppShellRuntimeStore((state) => state.mapLocationFocusKey);
  const setMapLocationFocusKey = useAppShellRuntimeStore((state) => state.setMapLocationFocusKey);
  const stampActionStatus = useAppShellRuntimeStore((state) => state.stampActionStatus);
  const setStampActionStatus = useAppShellRuntimeStore((state) => state.setStampActionStatus);
  const stampActionMessage = useAppShellRuntimeStore((state) => state.stampActionMessage);
  const setStampActionMessage = useAppShellRuntimeStore((state) => state.setStampActionMessage);
  const bootstrapStatus = useAppShellRuntimeStore((state) => state.bootstrapStatus);
  const bootstrapError = useAppShellRuntimeStore((state) => state.bootstrapError);
  const reviewSubmitting = useAppPageRuntimeStore((state) => state.reviewSubmitting);
  const reviewError = useAppPageRuntimeStore((state) => state.reviewError);
  const reviewLikeUpdatingId = useAppPageRuntimeStore((state) => state.reviewLikeUpdatingId);
  const commentSubmittingReviewId = useAppPageRuntimeStore((state) => state.commentSubmittingReviewId);
  const commentMutatingId = useAppPageRuntimeStore((state) => state.commentMutatingId);
  const deletingReviewId = useAppPageRuntimeStore((state) => state.deletingReviewId);
  const routeSubmitting = useAppPageRuntimeStore((state) => state.routeSubmitting);
  const setRouteSubmitting = useAppPageRuntimeStore((state) => state.setRouteSubmitting);
  const routeError = useAppPageRuntimeStore((state) => state.routeError);
  const setRouteError = useAppPageRuntimeStore((state) => state.setRouteError);
  const routeLikeUpdatingId = useAppPageRuntimeStore((state) => state.routeLikeUpdatingId);
  const setRouteLikeUpdatingId = useAppPageRuntimeStore((state) => state.setRouteLikeUpdatingId);
  const profileSaving = useAppPageRuntimeStore((state) => state.profileSaving);
  const setProfileSaving = useAppPageRuntimeStore((state) => state.setProfileSaving);
  const profileError = useAppPageRuntimeStore((state) => state.profileError);
  const setProfileError = useAppPageRuntimeStore((state) => state.setProfileError);
  const myPageError = useAppPageRuntimeStore((state) => state.myPageError);
  const setMyPageError = useAppPageRuntimeStore((state) => state.setMyPageError);
  const isLoggingOut = useAppPageRuntimeStore((state) => state.isLoggingOut);
  const setIsLoggingOut = useAppPageRuntimeStore((state) => state.setIsLoggingOut);
  const feedHasMore = useAppPageRuntimeStore((state) => state.feedHasMore);
  const feedLoadingMore = useAppPageRuntimeStore((state) => state.feedLoadingMore);
  const myCommentsHasMore = useAppPageRuntimeStore((state) => state.myCommentsHasMore);
  const myCommentsLoadingMore = useAppPageRuntimeStore((state) => state.myCommentsLoadingMore);
  const myCommentsLoadedOnce = useAppPageRuntimeStore((state) => state.myCommentsLoadedOnce);

  useEffect(() => {
    const initialNotice = getInitialNotice();
    if (!initialNotice) {
      return;
    }
    setNotice((current) => current ?? initialNotice);
  }, [setNotice]);
  const sessionUser = useAuthStore((state) => state.sessionUser);
  const providers = useAuthStore((state) => state.providers);

  const {
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
    startProviderLogin,
    handleUpdateProfile,
    handleLogout,
  } = useAppAuthActions({
    setMyPage,
    formatErrorMessage,
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
    setCourses,
    setAdminLoading,
    setAdminSummary,
    setMyPage,
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
    handleOpenCommunityRouteWithReturn,
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
    setHighlightedRouteId,
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
    notifications,
    unreadNotificationCount,
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    handleDeleteNotification,
    handleOpenGlobalNotification,
  } = useGlobalNotifications({
    sessionUser,
    myPage,
    goToTab,
    setMyPageTab,
    handleOpenCommentWithReturn,
    handleOpenReviewWithReturn,
  });

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
    loadMoreFeedReviews,
    loadMoreMyComments,
  } = useAppPagePaginationActions({
    sessionUser,
    myPage,
    setReviews,
    setMyPage,
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
  });

  const {
    refreshCurrentPosition,
    handleClaimStamp,
  } = useAppMapActions({
    sessionUser,
    setPlaces,
    setStampState,
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
    setSelectedPlaceReviews,
    setReviews,
    setMyPage,
    setNotice,
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
    setMyPage,
    communityRoutesCacheRef,
    patchCommunityRoutes,
    refreshMyPageForUser,
    formatErrorMessage,
    goToTab,
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
    handleOpenRouteFromMyPage,
  } = useAppPageStageActions({
    sessionUser,
    setFeedPlaceFilterId,
    setCommunityRouteSort,
    handleOpenCommentWithReturn,
    handleOpenCommunityRouteWithReturn,
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
                highlightedRouteId,
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
                onOpenRouteFromMyPage: handleOpenRouteFromMyPage,
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
