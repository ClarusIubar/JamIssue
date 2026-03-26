import { getReviewDetail } from '../api/client';
import type { ReturnViewState } from '../store/app-ui-store';
import type {
  DrawerState,
  MyPageTabKey,
  Review,
  RoutePreview,
  Tab,
} from '../types';

interface UseAppNavigationHelpersParams {
  activeTab: Tab;
  myPageTab: MyPageTabKey;
  activeCommentReviewId: string | null;
  highlightedCommentId: string | null;
  highlightedReviewId: string | null;
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  drawerState: DrawerState;
  feedPlaceFilterId: string | null;
  reviews: Review[];
  selectedPlaceReviews: Review[];
  myPageReviews: Review[];
  setActiveCommentReviewId: (reviewId: string | null) => void;
  setHighlightedCommentId: (commentId: string | null) => void;
  setHighlightedReviewId: (reviewId: string | null) => void;
  setReturnView: (value: ReturnViewState | null) => void;
  setSelectedRoutePreview: (route: RoutePreview | null) => void;
  setFeedPlaceFilterId: (placeId: string | null) => void;
  setNotice: (message: string) => void;
  goToTab: (tab: Tab, historyMode?: 'push' | 'replace') => void;
  commitRouteState: (
    nextState: { tab: Tab; placeId: string | null; festivalId: string | null; drawerState: DrawerState },
    historyMode?: 'push' | 'replace',
  ) => void;
  openPlace: (placeId: string) => void;
  openFestival: (festivalId: string) => void;
  upsertReviewCollections: (review: Review) => void;
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
}

function createReturnView(params: ReturnViewState): ReturnViewState {
  return params;
}

export function useAppNavigationHelpers({
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
  myPageReviews,
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
}: UseAppNavigationHelpersParams) {
  function snapshotReturnView(overrides: Partial<ReturnViewState> = {}) {
    return createReturnView({
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
    });
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
      setReturnView(snapshotReturnView());
    }
    setSelectedRoutePreview(route);
    handleCloseReviewComments();
    commitRouteState({ tab: 'map', placeId: null, festivalId: null, drawerState: 'closed' }, activeTab === 'map' ? 'replace' : 'push');
  }

  function handleOpenPlaceWithReturn(placeId: string) {
    if (activeTab !== 'map') {
      const preserveFeedFocus = activeTab !== 'feed';
      setReturnView(snapshotReturnView({
        activeCommentReviewId: preserveFeedFocus ? activeCommentReviewId : null,
        highlightedCommentId: preserveFeedFocus ? highlightedCommentId : null,
        highlightedReviewId: preserveFeedFocus ? highlightedReviewId : null,
      }));
    }
    setSelectedRoutePreview(null);
    openPlace(placeId);
  }

  function handleOpenFestivalWithReturn(festivalId: string) {
    if (activeTab !== 'map') {
      setReturnView(snapshotReturnView());
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
      setReturnView(snapshotReturnView());
    }
    setFeedPlaceFilterId(null);
    setHighlightedReviewId(reviewId);
    setHighlightedCommentId(null);
    setActiveCommentReviewId(null);
    goToTab('feed');
  }

  function handleOpenPlaceFeedWithReturn(placeId: string) {
    if (activeTab !== 'feed') {
      setReturnView(snapshotReturnView());
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
      setReturnView(snapshotReturnView());
    }
    await ensureReviewLoadedById(reviewId);
    handleOpenReviewComments(reviewId, commentId);
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
  };
}
