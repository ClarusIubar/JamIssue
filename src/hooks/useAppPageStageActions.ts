import { useCallback } from 'react';
import type { SessionUser } from '../types';

interface UseAppPageStageActionsParams {
  sessionUser: SessionUser | null;
  setFeedPlaceFilterId: (placeId: string | null) => void;
  setCommunityRouteSort: (sort: 'popular' | 'latest') => void;
  handleOpenCommentWithReturn: (reviewId: string, commentId: string) => void;
  handleOpenCommunityRouteWithReturn: (routeId: string) => void;
  fetchCommunityRoutes: (sort: 'popular' | 'latest') => Promise<unknown>;
  refreshMyPageForUser: (user: SessionUser | null, force?: boolean) => Promise<unknown>;
  reportBackgroundError: (error: unknown) => void;
}

export function useAppPageStageActions({
  sessionUser,
  setFeedPlaceFilterId,
  setCommunityRouteSort,
  handleOpenCommentWithReturn,
  handleOpenCommunityRouteWithReturn,
  fetchCommunityRoutes,
  refreshMyPageForUser,
  reportBackgroundError,
}: UseAppPageStageActionsParams) {
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

  const handleOpenRouteFromMyPage = useCallback(async (routeId: string) => {
    setCommunityRouteSort('latest');
    await fetchCommunityRoutes('latest');
    handleOpenCommunityRouteWithReturn(routeId);
  }, [fetchCommunityRoutes, handleOpenCommunityRouteWithReturn, setCommunityRouteSort]);

  return {
    handleClearPlaceFilter,
    handleChangeRouteSort,
    handleRetryMyPage,
    handleOpenCommentFromMyPage,
    handleOpenRouteFromMyPage,
  };
}
