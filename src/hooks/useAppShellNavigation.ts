import type { DrawerState, MyPageTabKey, RoutePreview, Tab } from '../types';
import type { ReturnViewState } from '../store/app-ui-store';

interface UseAppShellNavigationParams {
  returnView: ReturnViewState | null;
  activeCommentReviewId: string | null;
  activeTab: Tab;
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  drawerState: DrawerState;
  selectedRoutePreview: RoutePreview | null;
  setMyPageTab: (value: MyPageTabKey) => void;
  setActiveCommentReviewId: (value: string | null) => void;
  setHighlightedCommentId: (value: string | null) => void;
  setHighlightedReviewId: (value: string | null) => void;
  setFeedPlaceFilterId: (value: string | null) => void;
  setSelectedRoutePreview: (value: RoutePreview | null) => void;
  setReturnView: (value: ReturnViewState | null) => void;
  handleCloseReviewComments: () => void;
  goToTab: (tab: Tab, historyMode?: 'push' | 'replace') => void;
  commitRouteState: (
    nextState: { tab: Tab; placeId: string | null; festivalId: string | null; drawerState: DrawerState },
    historyMode?: 'push' | 'replace',
  ) => void;
}

export function useAppShellNavigation({
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
}: UseAppShellNavigationParams) {
  const canNavigateBack =
    returnView !== null ||
    activeCommentReviewId !== null ||
    activeTab !== 'map' ||
    selectedPlaceId !== null ||
    selectedFestivalId !== null ||
    drawerState !== 'closed' ||
    selectedRoutePreview !== null ||
    (typeof window !== 'undefined' && window.history.length > 1);

  function handleNavigateBack() {
    if (returnView) {
      setMyPageTab(returnView.myPageTab);
      setActiveCommentReviewId(returnView.activeCommentReviewId);
      setHighlightedCommentId(returnView.highlightedCommentId);
      setHighlightedReviewId(returnView.highlightedReviewId);
      setFeedPlaceFilterId(returnView.feedPlaceFilterId);
      setSelectedRoutePreview(null);
      const nextTab = returnView.tab;
      setReturnView(null);
      commitRouteState(
        {
          tab: nextTab,
          placeId: nextTab === 'map' ? returnView.placeId : null,
          festivalId: nextTab === 'map' ? returnView.festivalId : null,
          drawerState: nextTab === 'map' ? returnView.drawerState : 'closed',
        },
        'replace',
      );
      return;
    }

    if (selectedRoutePreview) {
      setSelectedRoutePreview(null);
      return;
    }

    if (activeCommentReviewId !== null) {
      handleCloseReviewComments();
      return;
    }

    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
      return;
    }

    handleCloseReviewComments();
    goToTab('map', 'replace');
  }

  function handleBottomNavChange(nextTab: Tab) {
    setSelectedRoutePreview(null);
    handleCloseReviewComments();

    if (nextTab !== 'feed') {
      setFeedPlaceFilterId(null);
      setHighlightedReviewId(null);
    }

    if (nextTab === 'map') {
      commitRouteState(
        {
          tab: 'map',
          placeId: selectedPlaceId,
          festivalId: selectedFestivalId,
          drawerState,
        },
        'replace',
      );
      return;
    }

    commitRouteState(
      {
        tab: nextTab,
        placeId: null,
        festivalId: null,
        drawerState: 'closed',
      },
      'push',
    );
  }

  return {
    canNavigateBack,
    handleNavigateBack,
    handleBottomNavChange,
  };
}
