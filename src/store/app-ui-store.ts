import { create } from 'zustand';
import type { Category, DrawerState, MyPageTabKey, RoutePreview, Tab } from '../types';
import { resolveValue, type SetterValue } from './store-utils';

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

type AppUIState = {
  activeTab: Tab;
  drawerState: DrawerState;
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  activeCategory: Category;
  selectedRoutePreview: RoutePreview | null;
  returnView: ReturnViewState | null;
  setActiveTab: (value: SetterValue<Tab>) => void;
  setDrawerState: (value: SetterValue<DrawerState>) => void;
  setSelectedPlaceId: (value: SetterValue<string | null>) => void;
  setSelectedFestivalId: (value: SetterValue<string | null>) => void;
  setActiveCategory: (value: SetterValue<Category>) => void;
  setSelectedRoutePreview: (value: SetterValue<RoutePreview | null>) => void;
  setReturnView: (value: SetterValue<ReturnViewState | null>) => void;
};

export const useAppUIStore = create<AppUIState>((set) => ({
  activeTab: 'map',
  drawerState: 'closed',
  selectedPlaceId: null,
  selectedFestivalId: null,
  activeCategory: 'all',
  selectedRoutePreview: null,
  returnView: null,
  setActiveTab: (value) => set((state) => ({ activeTab: resolveValue(value, state.activeTab) })),
  setDrawerState: (value) => set((state) => ({ drawerState: resolveValue(value, state.drawerState) })),
  setSelectedPlaceId: (value) => set((state) => ({ selectedPlaceId: resolveValue(value, state.selectedPlaceId) })),
  setSelectedFestivalId: (value) => set((state) => ({ selectedFestivalId: resolveValue(value, state.selectedFestivalId) })),
  setActiveCategory: (value) => set((state) => ({ activeCategory: resolveValue(value, state.activeCategory) })),
  setSelectedRoutePreview: (value) => set((state) => ({ selectedRoutePreview: resolveValue(value, state.selectedRoutePreview) })),
  setReturnView: (value) => set((state) => ({ returnView: resolveValue(value, state.returnView) })),
}));
