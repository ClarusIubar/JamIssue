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

/**
 * 사용자 인터랙션(탭 이동, 뒤로가기, 리뷰 클릭 등)에 따른 화면 이동과
 * 복귀를 위한 상태 캐싱(ReturnView) 로직을 전담하는 커스텀 훅입니다.
 */
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
  /**
   * 다른 화면으로 넘어갈 때, 현재 화면 상태를 기억하기 위해 `ReturnViewState` 객체를 생성합니다.
   * overrides 파라미터로 일부 값을 덮어쓸 수 있습니다.
   */
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

  /**
   * 특정 리뷰에 달린 전체 댓글 목록을 보기 위해 피드 탭의 댓글 바텀시트를 엽니다.
   */
  function handleOpenReviewComments(reviewId: string, commentId: string | null = null) {
    goToTab('feed');
    setHighlightedReviewId(reviewId ?? null);
    setActiveCommentReviewId(reviewId);
    setHighlightedCommentId(commentId);
  }

  /**
   * 열려 있는 피드 탭의 댓글 바텀시트를 닫습니다.
   */
  function handleCloseReviewComments() {
    setActiveCommentReviewId(null);
    setHighlightedCommentId(null);
  }

  /**
   * 큐레이션 코스나 유저 생성 루트를 눌러서, 지도에 표시할 코스 프리뷰(미리보기) 화면으로 진입합니다.
   */
  function handleOpenRoutePreview(route: RoutePreview) {
    if (activeTab !== 'map') {
      setReturnView(buildReturnView());
    }
    setSelectedRoutePreview(route);
    handleCloseReviewComments();
    commitRouteState({ tab: 'map', placeId: null, festivalId: null, drawerState: 'closed' }, activeTab === 'map' ? 'replace' : 'push');
  }

  /**
   * 지도 탭 이외의 다른 곳(피드, 코스, 마이페이지 등)에서 장소 상세 정보를 보기 위해
   * 지도 탭으로 넘어가면서 돌아올 뷰(ReturnView) 상태를 캐싱합니다.
   */
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

  /**
   * 지도 탭 이외의 곳에서 축제 상세 바텀시트를 보기 위해 이동하며, 돌아올 뷰를 저장합니다.
   */
  function handleOpenFestivalWithReturn(festivalId: string) {
    if (activeTab !== 'map') {
      setReturnView(buildReturnView());
    }
    setSelectedRoutePreview(null);
    openFestival(festivalId);
  }

  /**
   * 주어진 리뷰 ID를 상태에서 찾아보고 없으면 서버 API를 통해 가져와 상태에 넣습니다. (캐싱)
   */
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

  /**
   * 피드 탭 이외의 곳에서 특정 리뷰 카드로 넘어가기 위해 이동하며, 돌아올 뷰를 저장합니다.
   */
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

  /**
   * 특정 장소에 달린 모든 리뷰(피드)를 필터링해서 보기 위해 피드 탭으로 넘어갑니다.
   */
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

  /**
   * 마이페이지의 '내가 쓴 댓글' 등에서 리뷰의 댓글 바텀시트로 바로 점프하기 위해 호출됩니다.
   */
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

  /**
   * 상단 네비게이션(플로팅) 바의 뒤로가기 버튼을 클릭했을 때의 동작입니다.
   * `ReturnViewState`가 저장되어 있다면 해당 뷰로 복원하고,
   * 그렇지 않다면 브라우저의 History Back을 실행하거나 기본적으로 지도 탭으로 돌아갑니다.
   */
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

  /**
   * 최하단의 바텀 탭 네비게이션(GNB) 아이콘을 눌러 메인 탭을 변경할 때 호출됩니다.
   */
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
