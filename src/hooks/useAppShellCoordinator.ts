import { useEffect } from 'react';
import {
  getInitialNotice,
  getInitialMapViewport,
  type useAppRouteState,
} from './useAppRouteState';
import type { useAuthDomainState } from './useAuthDomainState';
import type { useAppShellRuntimeState } from './useAppShellRuntimeState';
import type { useAppPageRuntimeState } from './useAppPageRuntimeState';
import type { useAppDataState } from './useAppDataState';
import type { useMapCategoryState } from './useMapCategoryState';
import type { useMyPageDomainState } from './useMyPageDomainState';
import type { useReturnViewDomainState } from './useReturnViewDomainState';
import type { useReviewFilterState } from './useReviewFilterState';
import type { useReviewHighlightState } from './useReviewHighlightState';
import type { useRoutePreviewState } from './useRoutePreviewState';
import { useAppAuthActions } from './useAppAuthActions';
import { useAppTabDataLoaders } from './useAppTabDataLoaders';
import { useAppNavigationHelpers } from './useAppNavigationHelpers';
import { useGlobalNotifications } from './useGlobalNotifications';
import { useAppViewModels } from './useAppViewModels';
import { useAppPagePaginationActions } from './useAppPagePaginationActions';
import { useActiveReviewComments } from './useActiveReviewComments';
import { useAppFeedbackEffects } from './useAppFeedbackEffects';
import { useAppBootstrapLifecycle } from './useAppBootstrapLifecycle';
import { useAppMapActions } from './useAppMapActions';
import { useAppReviewActions } from './useAppReviewActions';
import { useAppRouteActions } from './useAppRouteActions';
import { useAppAdminActions } from './useAppAdminActions';
import { useAppShellNavigation } from './useAppShellNavigation';
import { useAppStageActions } from './useAppStageActions';
import { useAppPageStageActions } from './useAppPageStageActions';

const STAMP_UNLOCK_RADIUS_METERS = 120;
const NOTICE_DISMISS_DELAY_MS = 4000;

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
}

function reportBackgroundError(error: unknown) {
  console.error(error);
}

type RouteState = ReturnType<typeof useAppRouteState>;
type DomainState =
  & ReturnType<typeof useMyPageDomainState>
  & ReturnType<typeof useReviewFilterState>
  & ReturnType<typeof useReviewHighlightState>
  & ReturnType<typeof useMapCategoryState>
  & ReturnType<typeof useRoutePreviewState>
  & ReturnType<typeof useReturnViewDomainState>
  & ReturnType<typeof useAuthDomainState>;
type ShellRuntimeState = ReturnType<typeof useAppShellRuntimeState>;
type PageRuntimeState = ReturnType<typeof useAppPageRuntimeState>;
type DataState = ReturnType<typeof useAppDataState>;

type CoordinatorArgs = {
  routeState: RouteState;
  domainState: DomainState;
  shellRuntimeState: ShellRuntimeState;
  pageRuntimeState: PageRuntimeState;
  dataState: DataState;
  initialMapViewport: ReturnType<typeof getInitialMapViewport>;
};

export function useAppShellCoordinator({
  routeState,
  domainState,
  shellRuntimeState,
  pageRuntimeState,
  dataState,
  initialMapViewport,
}: CoordinatorArgs) {
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
  } = routeState;
  const {
    myPageTab,
    setMyPageTab,
    feedPlaceFilterId,
    setFeedPlaceFilterId,
    activeCategory,
    setActiveCategory,
    activeCommentReviewId,
    setActiveCommentReviewId,
    highlightedCommentId,
    setHighlightedCommentId,
    highlightedReviewId,
    setHighlightedReviewId,
    highlightedRouteId,
    setHighlightedRouteId,
    selectedRoutePreview,
    setSelectedRoutePreview,
    returnView,
    setReturnView,
    sessionUser,
    providers,
  } = domainState;
  const {
    notice,
    setNotice,
    currentPosition,
    mapLocationStatus,
    mapLocationMessage,
    mapLocationFocusKey,
    stampActionStatus,
    stampActionMessage,
    bootstrapStatus,
    bootstrapError,
  } = shellRuntimeState;
  const {
    reviewSubmitting,
    reviewError,
    reviewLikeUpdatingId,
    commentSubmittingReviewId,
    commentMutatingId,
    deletingReviewId,
    routeSubmitting,
    setRouteSubmitting,
    routeError,
    setRouteError,
    routeLikeUpdatingId,
    setRouteLikeUpdatingId,
    profileSaving,
    setProfileSaving,
    profileError,
    setProfileError,
    myPageError,
    setMyPageError,
    isLoggingOut,
    setIsLoggingOut,
    feedHasMore,
    feedLoadingMore,
    myCommentsHasMore,
    myCommentsLoadingMore,
    myCommentsLoadedOnce,
  } = pageRuntimeState;
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
    setHasRealData,
    communityRoutes,
    setCommunityRoutes,
    communityRouteSort,
    setCommunityRouteSort,
    myPage,
    setMyPage,
    adminSummary,
    adminBusyPlaceId,
    adminLoading,
    setAdminSummary,
    setAdminBusyPlaceId,
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
  } = dataState;

  useEffect(() => {
    const initialNotice = getInitialNotice();
    if (!initialNotice) {
      return;
    }
    setNotice((current) => current ?? initialNotice);
  }, [setNotice]);

  const { startProviderLogin, handleUpdateProfile, handleLogout } = useAppAuthActions({
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

  const viewModels = useAppViewModels({
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

  const { loadMoreFeedReviews, loadMoreMyComments } = useAppPagePaginationActions({
    sessionUser,
    myPage,
    setReviews,
    setMyPage,
    reportBackgroundError,
  });

  const activeReviewCommentsState = useActiveReviewComments({
    activeCommentReviewId,
    setNotice,
    formatErrorMessage,
  });

  useAppFeedbackEffects({
    selectedPlace: viewModels.selectedPlace,
    selectedPlaceDistanceMeters: viewModels.selectedPlaceDistanceMeters,
    sessionUser,
    todayStamp: viewModels.todayStamp,
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

  const { refreshCurrentPosition, handleClaimStamp } = useAppMapActions({
    sessionUser,
    setPlaces,
    setStampState,
    goToTab,
    commitRouteState,
    refreshMyPageForUser,
    formatErrorMessage,
  });

  const reviewActions = useAppReviewActions({
    activeTab,
    sessionUser,
    selectedPlace: viewModels.selectedPlace,
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
    syncReviewComments: activeReviewCommentsState.syncReviewComments,
    clearReviewComments: activeReviewCommentsState.clearReviewComments,
    formatErrorMessage,
  });

  const routeActions = useAppRouteActions({
    setMyPage,
    communityRoutesCacheRef,
    patchCommunityRoutes,
    refreshMyPageForUser,
    formatErrorMessage,
    goToTab,
  });

  const adminActions = useAppAdminActions({
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

  const shellNavigation = useAppShellNavigation({
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

  const mapStageActions = useAppStageActions({
    selectedPlace: viewModels.selectedPlace,
    selectedFestival: viewModels.selectedFestival,
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

  const pageStageActions = useAppPageStageActions({
    sessionUser,
    setFeedPlaceFilterId,
    setCommunityRouteSort,
    handleOpenCommentWithReturn,
    handleOpenCommunityRouteWithReturn,
    fetchCommunityRoutes,
    refreshMyPageForUser,
    reportBackgroundError,
  });

  return {
    notifications,
    unreadNotificationCount,
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    handleDeleteNotification,
    handleOpenGlobalNotification,
    handleOpenReviewComments,
    handleCloseReviewComments,
    handleOpenRoutePreview,
    handleOpenPlaceWithReturn,
    handleOpenReviewWithReturn,
    viewModels,
    loadMoreFeedReviews,
    loadMoreMyComments,
    activeReviewCommentsState,
    handleClaimStamp,
    reviewActions,
    routeActions,
    adminActions,
    shellNavigation,
    mapStageActions,
    pageStageActions,
    startProviderLogin,
    handleUpdateProfile,
    handleLogout,
    initialMapViewport,
    feedHasMore,
    feedLoadingMore,
    myCommentsHasMore,
    myCommentsLoadingMore,
    reviewSubmitting,
    reviewError,
    reviewLikeUpdatingId,
    commentSubmittingReviewId,
    commentMutatingId,
    deletingReviewId,
    routeSubmitting,
    routeError,
    routeLikeUpdatingId,
    profileSaving,
    profileError,
    myPageError,
    isLoggingOut,
    providers,
    activeCategory,
    setActiveCategory,
    selectedRoutePreview,
    activeCommentReviewId,
    highlightedCommentId,
    highlightedReviewId,
    highlightedRouteId,
    activeTab,
    drawerState,
    closeDrawer,
    feedPlaceFilterId,
    myPageTab,
    setMyPageTab,
    communityRoutes,
    communityRouteSort,
    courses,
    reviews,
    places,
    festivals,
    selectedPlaceReviews,
    currentPosition,
    mapLocationStatus,
    mapLocationFocusKey,
    sessionUser,
    stampActionStatus,
    stampActionMessage,
    myPage,
    adminSummary,
    adminBusyPlaceId,
    adminLoading,
  };
}
