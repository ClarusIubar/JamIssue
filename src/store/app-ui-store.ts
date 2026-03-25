import { create } from 'zustand';
import type { Category, DrawerState, MyPageTabKey, Tab } from '../types';

/**
 * 다른 화면에서 이전 상태로 되돌아가기 위해 임시 저장해 두는 뷰의 상태 정보 타입입니다.
 */
export type ReturnViewState = {
  tab: Tab;
  myPageTab: MyPageTabKey;
  activeCommentReviewId: string | null;
  highlightedCommentId: string | null;
  highlightedReviewId: string | null;
  placeId: string | null;
  festivalId: string | null;
  drawerState: DrawerState;
  feedPlaceFilterId: string | null;
};

type SetterValue<T> = T | ((current: T) => T);

/**
 * 상태 변경 시 함수형 혹은 값 자체를 입력받아 새로운 값을 반환하는 유틸리티 함수입니다.
 */
function resolveValue<T>(value: SetterValue<T>, current: T): T {
  return typeof value === 'function' ? (value as (current: T) => T)(current) : value;
}

/**
 * 앱의 전역 UI 상태를 관리하기 위한 Zustand 스토어의 상태 및 액션 인터페이스입니다.
 * 활성화된 탭, 바텀 시트의 열림 정도, 선택된 장소나 축제 ID, 필터 카테고리 등을 관리합니다.
 */
type AppUIState = {
  activeTab: Tab;
  drawerState: DrawerState;
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  myPageTab: MyPageTabKey;
  feedPlaceFilterId: string | null;
  activeCategory: Category;
  activeCommentReviewId: string | null;
  highlightedCommentId: string | null;
  highlightedReviewId: string | null;
  returnView: ReturnViewState | null;
  setActiveTab: (value: SetterValue<Tab>) => void;
  setDrawerState: (value: SetterValue<DrawerState>) => void;
  setSelectedPlaceId: (value: SetterValue<string | null>) => void;
  setSelectedFestivalId: (value: SetterValue<string | null>) => void;
  setMyPageTab: (value: SetterValue<MyPageTabKey>) => void;
  setFeedPlaceFilterId: (value: SetterValue<string | null>) => void;
  setActiveCategory: (value: SetterValue<Category>) => void;
  setActiveCommentReviewId: (value: SetterValue<string | null>) => void;
  setHighlightedCommentId: (value: SetterValue<string | null>) => void;
  setHighlightedReviewId: (value: SetterValue<string | null>) => void;
  setReturnView: (value: SetterValue<ReturnViewState | null>) => void;
};

/**
 * 화면 전환, 탭 이동, 바텀 시트 조작, 선택 상태 등 앱의 UI 관련 전역 상태를 다루는 커스텀 훅입니다.
 * Zustand 기반으로 구축되어 있습니다.
 */
export const useAppUIStore = create<AppUIState>((set) => ({
  activeTab: 'map',
  drawerState: 'closed',
  selectedPlaceId: null,
  selectedFestivalId: null,
  myPageTab: 'stamps',
  feedPlaceFilterId: null,
  activeCategory: 'all',
  activeCommentReviewId: null,
  highlightedCommentId: null,
  highlightedReviewId: null,
  returnView: null,
  setActiveTab: (value) => set((state) => ({ activeTab: resolveValue(value, state.activeTab) })),
  setDrawerState: (value) => set((state) => ({ drawerState: resolveValue(value, state.drawerState) })),
  setSelectedPlaceId: (value) => set((state) => ({ selectedPlaceId: resolveValue(value, state.selectedPlaceId) })),
  setSelectedFestivalId: (value) => set((state) => ({ selectedFestivalId: resolveValue(value, state.selectedFestivalId) })),
  setMyPageTab: (value) => set((state) => ({ myPageTab: resolveValue(value, state.myPageTab) })),
  setFeedPlaceFilterId: (value) => set((state) => ({ feedPlaceFilterId: resolveValue(value, state.feedPlaceFilterId) })),
  setActiveCategory: (value) => set((state) => ({ activeCategory: resolveValue(value, state.activeCategory) })),
  setActiveCommentReviewId: (value) => set((state) => ({ activeCommentReviewId: resolveValue(value, state.activeCommentReviewId) })),
  setHighlightedCommentId: (value) => set((state) => ({ highlightedCommentId: resolveValue(value, state.highlightedCommentId) })),
  setHighlightedReviewId: (value) => set((state) => ({ highlightedReviewId: resolveValue(value, state.highlightedReviewId) })),
  setReturnView: (value) => set((state) => ({ returnView: resolveValue(value, state.returnView) })),
}));
