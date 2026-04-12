import { useAppAuthActions } from './useAppAuthActions';
import { useAppTabDataLoaders } from './useAppTabDataLoaders';
import { useAppNavigationHelpers } from './useAppNavigationHelpers';
import { useGlobalNotifications } from './useGlobalNotifications';
import { useAppViewModels } from './useAppViewModels';
import { useAppPagePaginationActions } from './useAppPagePaginationActions';
import { useActiveReviewComments } from './useActiveReviewComments';
import type {
  DataState,
  DomainState,
  PageRuntimeState,
  RouteState,
  ShellRuntimeState,
} from './useAppShellCoordinator.types';

type CoordinatorServicesArgs = {
  routeState: RouteState;
  domainState: DomainState;
  shellRuntimeState: ShellRuntimeState;
  pageRuntimeState: PageRuntimeState;
  dataState: DataState;
};

export function useAppCoordinatorServices({
  routeState,
  domainState,
  shellRuntimeState,
  pageRuntimeState,
  dataState,
}: CoordinatorServicesArgs) {
  const {
    activeTab,
    drawerState,
    selectedPlaceId,
    selectedFestivalId,
    commitRouteState,
    goToTab,
    openPlace,
    openFestival,
  } = routeState;
  const {
    auth: { sessionUser },
    map: { activeCategory, selectedRoutePreview, setSelectedRoutePreview },
    myPage: { myPageTab, setMyPageTab },
    returnView: { setReturnView },
    review: {
      feedPlaceFilterId,
      activeCommentReviewId,
      highlightedCommentId,
      highlightedReviewId,
      setActiveCommentReviewId,
      setFeedPlaceFilterId,
      setHighlightedCommentId,
      setHighlightedReviewId,
      setHighlightedRouteId,
    },
  } = domainState;
  const {
    notice,
    setNotice,
    currentPosition,
    mapLocationStatus,
    mapLocationMessage,
    bootstrapStatus,
    bootstrapError,
  } = shellRuntimeState;
  const {
    adminSummary,
    communityRoutesCacheRef,
    coursesLoadedRef,
    feedLoadedRef,
    festivals,
    myPage,
    places,
    replaceCommunityRoutes,
    reviews,
    selectedPlaceReviews,
    setAdminLoading,
    setAdminSummary,
    setCommunityRoutes,
    setCourses,
    setMyPage,
    setReviews,
    stampState,
  } = dataState;

  const { startProviderLogin, handleUpdateProfile, handleLogout } = useAppAuthActions({
    setMyPage,
    formatErrorMessage,
  });

  const dataLoaders = useAppTabDataLoaders({
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

  const navigationHelpers = useAppNavigationHelpers({
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
    upsertReviewCollections: dataState.upsertReviewCollections,
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
    handleOpenCommentWithReturn: navigationHelpers.handleOpenCommentWithReturn,
    handleOpenReviewWithReturn: navigationHelpers.handleOpenReviewWithReturn,
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

  const paginationActions = useAppPagePaginationActions({
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

  return {
    startProviderLogin,
    handleUpdateProfile,
    handleLogout,
    dataLoaders,
    navigationHelpers,
    notifications,
    unreadNotificationCount,
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    handleDeleteNotification,
    handleOpenGlobalNotification,
    viewModels,
    paginationActions,
    activeReviewCommentsState,
    pageRuntimeState,
  };
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '?붿껌??泥섎━?섏? 紐삵뻽?댁슂. ?좎떆 ?ㅼ뿉 ?ㅼ떆 ?쒕룄??二쇱꽭??';
}

function reportBackgroundError(error: unknown) {
  console.error(error);
}
