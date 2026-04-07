import { useCallback } from 'react';
import type { RouteStateCommitOptions } from './useAppRouteState';
import type { DrawerState, Place, RoutePreview, SessionUser } from '../types';

interface UseAppStageActionsParams {
  selectedPlace: Place | null;
  selectedFestival: { id: string } | null;
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  drawerState: DrawerState;
  selectedRoutePreview: RoutePreview | null;
  sessionUser: SessionUser | null;
  setSelectedRoutePreview: (preview: RoutePreview | null) => void;
  setFeedPlaceFilterId: (placeId: string | null) => void;
  setCommunityRouteSort: (sort: 'popular' | 'latest') => void;
  commitRouteState: (
    nextState: { tab: 'map'; placeId: string | null; festivalId: string | null; drawerState: DrawerState },
    historyMode?: 'push' | 'replace',
    options?: RouteStateCommitOptions,
  ) => void;
  goToTab: (tab: 'my') => void;
  handleOpenPlaceFeedWithReturn: (placeId: string) => void;
  handleOpenCommentWithReturn: (reviewId: string, commentId: string) => void;
  refreshCurrentPosition: (shouldFocusMap: boolean) => Promise<void>;
  fetchCommunityRoutes: (sort: 'popular' | 'latest') => Promise<unknown>;
  refreshMyPageForUser: (user: SessionUser | null, force?: boolean) => Promise<unknown>;
  reportBackgroundError: (error: unknown) => void;
}

export function useAppStageActions({
  selectedPlace,
  selectedFestival,
  selectedPlaceId,
  selectedFestivalId,
  drawerState,
  selectedRoutePreview,
  sessionUser,
  setSelectedRoutePreview,
  setFeedPlaceFilterId,
  setCommunityRouteSort,
  commitRouteState,
  goToTab,
  handleOpenPlaceFeedWithReturn,
  handleOpenCommentWithReturn,
  refreshCurrentPosition,
  fetchCommunityRoutes,
  refreshMyPageForUser,
  reportBackgroundError,
}: UseAppStageActionsParams) {
  const handleMapOpenPlaceFeed = useCallback(() => {
    if (!selectedPlace) {
      return;
    }
    handleOpenPlaceFeedWithReturn(selectedPlace.id);
  }, [handleOpenPlaceFeedWithReturn, selectedPlace]);

  const handleMapOpenPlace = useCallback((placeId: string) => {
    setSelectedRoutePreview(null);
    commitRouteState({ tab: 'map', placeId, festivalId: null, drawerState: 'partial' }, 'push', { routePreview: null });
  }, [commitRouteState, setSelectedRoutePreview]);

  const handleMapOpenFestival = useCallback((festivalId: string) => {
    setSelectedRoutePreview(null);
    commitRouteState({ tab: 'map', placeId: null, festivalId, drawerState: 'partial' }, 'push', { routePreview: null });
  }, [commitRouteState, setSelectedRoutePreview]);

  const handleMapOpenRoutePreviewPlace = useCallback((placeId: string) => {
    commitRouteState(
      { tab: 'map', placeId, festivalId: null, drawerState: 'partial' },
      'push',
      { routePreview: selectedRoutePreview },
    );
  }, [commitRouteState, selectedRoutePreview]);

  const handleClearRoutePreview = useCallback(() => {
    setSelectedRoutePreview(null);
    commitRouteState(
      { tab: 'map', placeId: selectedPlaceId, festivalId: selectedFestivalId, drawerState },
      'replace',
      { routePreview: null },
    );
  }, [commitRouteState, drawerState, selectedFestivalId, selectedPlaceId, setSelectedRoutePreview]);

  const handleExpandPlaceDrawer = useCallback(() => {
    if (!selectedPlace) {
      return;
    }
    commitRouteState({ tab: 'map', placeId: selectedPlace.id, festivalId: null, drawerState: 'full' }, 'replace');
  }, [commitRouteState, selectedPlace]);

  const handleCollapsePlaceDrawer = useCallback(() => {
    if (!selectedPlace) {
      return;
    }
    commitRouteState({ tab: 'map', placeId: selectedPlace.id, festivalId: null, drawerState: 'partial' }, 'replace');
  }, [commitRouteState, selectedPlace]);

  const handleExpandFestivalDrawer = useCallback(() => {
    if (!selectedFestival) {
      return;
    }
    commitRouteState({ tab: 'map', placeId: null, festivalId: selectedFestival.id, drawerState: 'full' }, 'replace');
  }, [commitRouteState, selectedFestival]);

  const handleCollapseFestivalDrawer = useCallback(() => {
    if (!selectedFestival) {
      return;
    }
    commitRouteState({ tab: 'map', placeId: null, festivalId: selectedFestival.id, drawerState: 'partial' }, 'replace');
  }, [commitRouteState, selectedFestival]);

  const handleRequestLogin = useCallback(() => {
    goToTab('my');
  }, [goToTab]);

  const handleLocateCurrentPosition = useCallback(() => {
    void refreshCurrentPosition(true);
  }, [refreshCurrentPosition]);

  const handleClearPlaceFilter = useCallback(() => {
    setFeedPlaceFilterId(null);
  }, [setFeedPlaceFilterId]);

  const handleChangeRouteSort = useCallback((sort: 'popular' | 'latest') => {
    setCommunityRouteSort(sort);
    void fetchCommunityRoutes(sort).catch(reportBackgroundError);
  }, [fetchCommunityRoutes, reportBackgroundError, setCommunityRouteSort]);

  const handleRetryMyPage = useCallback(async () => {
    if (!sessionUser) {
      return;
    }
    await refreshMyPageForUser(sessionUser, true);
  }, [refreshMyPageForUser, sessionUser]);

  const handleOpenCommentFromMyPage = useCallback((reviewId: string, commentId: string) => {
    handleOpenCommentWithReturn(reviewId, commentId);
  }, [handleOpenCommentWithReturn]);

  return {
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
    handleClearPlaceFilter,
    handleChangeRouteSort,
    handleRetryMyPage,
    handleOpenCommentFromMyPage,
  };
}
