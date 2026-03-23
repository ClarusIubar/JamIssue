import { getReviewDetail } from '../api/client';
import type { MyPageTabKey, Review, RoutePreview, Tab } from '../types';
import type { ReturnViewState } from '../store/app-ui-store';
import type { Dispatch, SetStateAction } from 'react';

type SetState<T> = Dispatch<SetStateAction<T>>;
type HistoryMode = 'push' | 'replace';

interface UseAppNavigationActionsParams {
  activeTab: Tab;
  myPageTab: MyPageTabKey;
  activeCommentReviewId: string | null;
  highlightedCommentId: string | null;
  highlightedReviewId: string | null;
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  drawerState: 'closed' | 'partial' | 'full';
  feedPlaceFilterId: string | null;
  selectedRoutePreview: RoutePreview | null;
  reviews: Review[];
  selectedPlaceReviews: Review[];
  myPageReviews: Review[];
  setActiveCommentReviewId: (value: string | null) => void;
  setHighlightedCommentId: (value: string | null) => void;
  setHighlightedReviewId: (value: string | null) => void;
  setReturnView: (value: ReturnViewState | null) => void;
  returnView: ReturnViewState | null;
  setSelectedRoutePreview: SetState<RoutePreview | null>;
  setFeedPlaceFilterId: (value: string | null) => void;
  setMyPageTab: (value: MyPageTabKey) => void;
  setNotice: (value: string | null) => void;
  upsertReviewCollections: (review: Review) => void;
  commitRouteState: (
    nextState: { tab: Tab; placeId: string | null; festivalId: string | null; drawerState: 'closed' | 'partial' | 'full' },
    historyMode?: HistoryMode,
  ) => void;
  goToTab: (nextTab: Tab, historyMode?: HistoryMode) => void;
  openPlace: (placeId: string) => void;
  openFestival: (festivalId: string) => void;
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
}

export function useAppNavigationActions({
  activeTab,
  myPageTab,
  activeCommentReviewId,
  highlightedCommentId,
  highlightedReviewId,
  selectedPlaceId,
  selectedFestivalId,
  drawerState,
  feedPlaceFilterId,
  selectedRoutePreview,
  reviews,
  selectedPlaceReviews,
  myPageReviews,
  setActiveCommentReviewId,
  setHighlightedCommentId,
  setHighlightedReviewId,
  setReturnView,
  returnView,
  setSelectedRoutePreview,
  setFeedPlaceFilterId,
  setMyPageTab,
  setNotice,
  upsertReviewCollections,
  commitRouteState,
  goToTab,
  openPlace,
  openFestival,
}: UseAppNavigationActionsParams) {
  function buildReturnView(overrides?: Partial<ReturnViewState>): ReturnViewState {
    return {
      tab: activeTab,
      myPageTab,
      activeCommentReviewId,
      highlightedCommentId,
      highlightedReviewId,
      placeId: selectedPlaceId,
      festivalId: selectedFestivalId,
      drawerState,
      feedPlaceFilterId,
      ...overrides,
    };
  }

  function handleOpenReviewComments(reviewId: string, commentId: string | null = null) {
    goToTab('feed');
    setHighlightedReviewId(reviewId ?? null);
    setActiveCommentReviewId(reviewId);
    setHighlightedCommentId(commentId);
  }

  function handleCloseReviewComments() {
    setActiveCommentReviewId(null);
    setHighlightedCommentId(null);
  }

  function handleOpenRoutePreview(route: RoutePreview) {
    if (activeTab !== 'map') {
      setReturnView(buildReturnView());
    }
    setSelectedRoutePreview(route);
    handleCloseReviewComments();
    commitRouteState({ tab: 'map', placeId: null, festivalId: null, drawerState: 'closed' }, activeTab === 'map' ? 'replace' : 'push');
  }

  function handleOpenPlaceWithReturn(placeId: string) {
    if (activeTab !== 'map') {
      const preserveFeedFocus = activeTab !== 'feed';
      setReturnView(
        buildReturnView({
          activeCommentReviewId: preserveFeedFocus ? activeCommentReviewId : null,
          highlightedCommentId: preserveFeedFocus ? highlightedCommentId : null,
          highlightedReviewId: preserveFeedFocus ? highlightedReviewId : null,
        }),
      );
    }
    setSelectedRoutePreview(null);
    openPlace(placeId);
  }

  function handleOpenFestivalWithReturn(festivalId: string) {
    if (activeTab !== 'map') {
      setReturnView(buildReturnView());
    }
    setSelectedRoutePreview(null);
    openFestival(festivalId);
  }

  async function ensureReviewLoadedById(reviewId: string | null) {
    if (!reviewId) {
      return null;
    }

    const existing = [...reviews, ...selectedPlaceReviews, ...myPageReviews].find((review) => review.id === reviewId) ?? null;
    if (existing) {
      upsertReviewCollections(existing);
      return existing;
    }

    try {
      const loaded = await getReviewDetail(reviewId);
      upsertReviewCollections(loaded);
      return loaded;
    } catch (error) {
      setNotice(formatErrorMessage(error));
      return null;
    }
  }

  async function handleOpenReviewWithReturn(reviewId: string | null) {
    await ensureReviewLoadedById(reviewId);
    if (activeTab !== 'feed') {
      setReturnView(buildReturnView());
    }
    setFeedPlaceFilterId(null);
    setHighlightedReviewId(reviewId);
    setHighlightedCommentId(null);
    setActiveCommentReviewId(null);
    goToTab('feed');
  }

  function handleOpenPlaceFeedWithReturn(placeId: string) {
    if (activeTab !== 'feed') {
      setReturnView(buildReturnView());
    }
    setSelectedRoutePreview(null);
    setFeedPlaceFilterId(placeId);
    setHighlightedReviewId(null);
    setHighlightedCommentId(null);
    setActiveCommentReviewId(null);
    goToTab('feed');
  }

  async function handleOpenCommentWithReturn(reviewId: string, commentId: string | null = null) {
    if (activeTab !== 'feed') {
      setReturnView(buildReturnView());
    }
    await ensureReviewLoadedById(reviewId);
    handleOpenReviewComments(reviewId, commentId);
  }

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
    handleOpenReviewComments,
    handleCloseReviewComments,
    handleOpenRoutePreview,
    handleOpenPlaceWithReturn,
    handleOpenFestivalWithReturn,
    handleOpenReviewWithReturn,
    handleOpenPlaceFeedWithReturn,
    handleOpenCommentWithReturn,
    canNavigateBack,
    handleNavigateBack,
    handleBottomNavChange,
  };
}
