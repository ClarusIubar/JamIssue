import { useAppMapActions } from './useAppMapActions';
import { useAppReviewActions } from './useAppReviewActions';
import { useAppRouteActions } from './useAppRouteActions';
import { useAppAdminActions } from './useAppAdminActions';
import { useAppShellNavigation } from './useAppShellNavigation';
import { useAppStageActions } from './useAppStageActions';
import { useAppPageStageActions } from './useAppPageStageActions';
import type {
  DataState,
  DomainState,
  RouteState,
  ShellRuntimeState,
} from './useAppShellCoordinator.types';
import type { useAppCoordinatorServices } from './useAppCoordinatorServices';

type CoordinatorActionsArgs = {
  routeState: RouteState;
  domainState: DomainState;
  shellRuntimeState: ShellRuntimeState;
  dataState: DataState;
  services: ReturnType<typeof useAppCoordinatorServices>;
};

export function useAppCoordinatorActions({
  routeState,
  domainState,
  shellRuntimeState,
  dataState,
  services,
}: CoordinatorActionsArgs) {
  const {
    activeTab,
    commitRouteState,
    drawerState,
    goToTab,
    selectedFestivalId,
    selectedPlaceId,
  } = routeState;
  const {
    auth: { sessionUser },
    map: { selectedRoutePreview, setSelectedRoutePreview },
    myPage: { setMyPageTab },
    returnView: { returnView, setReturnView },
    review: {
      activeCommentReviewId,
      highlightedReviewId,
      setActiveCommentReviewId,
      setFeedPlaceFilterId,
      setHighlightedCommentId,
      setHighlightedReviewId,
    },
  } = domainState;
  const { setNotice } = shellRuntimeState;
  const {
    communityRoutesCacheRef,
    communityRouteSort,
    adminSummary,
    patchCommunityRoutes,
    patchReviewCollections,
    placeReviewsCacheRef,
    myPage,
    reviews,
    selectedPlaceReviews,
    setAdminBusyPlaceId,
    setAdminLoading,
    setAdminSummary,
    setFestivals,
    setHasRealData,
    setMyPage,
    setPlaces,
    setReviews,
    setSelectedPlaceReviews,
    setStampState,
    upsertReviewCollections,
  } = dataState;
  const {
    activeReviewCommentsState,
    dataLoaders: { fetchCommunityRoutes, refreshAdminSummary, refreshMyPageForUser },
    navigationHelpers: {
      handleCloseReviewComments,
      handleOpenCommentWithReturn,
      handleOpenCommunityRouteWithReturn,
      handleOpenPlaceFeedWithReturn,
    },
    viewModels,
  } = services;

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
    setCommunityRouteSort: dataState.setCommunityRouteSort,
    handleOpenCommentWithReturn,
    handleOpenCommunityRouteWithReturn,
    fetchCommunityRoutes,
    refreshMyPageForUser,
    reportBackgroundError,
  });

  return {
    handleClaimStamp,
    reviewActions,
    routeActions,
    adminActions,
    shellNavigation,
    mapStageActions,
    pageStageActions,
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
