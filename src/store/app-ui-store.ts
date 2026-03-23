import { create } from 'zustand';
import type { Category, DrawerState, MyPageTabKey, Tab } from '../types';

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

function resolveValue<T>(value: SetterValue<T>, current: T): T {
  return typeof value === 'function' ? (value as (current: T) => T)(current) : value;
}

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
