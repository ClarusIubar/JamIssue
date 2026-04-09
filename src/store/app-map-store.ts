import { create } from 'zustand';
import type { Category, RoutePreview } from '../types';
import { resolveValue, type SetterValue } from './store-utils';

type AppMapStoreState = {
  activeCategory: Category;
  selectedRoutePreview: RoutePreview | null;
  setActiveCategory: (value: SetterValue<Category>) => void;
  setSelectedRoutePreview: (value: SetterValue<RoutePreview | null>) => void;
};

export const useAppMapStore = create<AppMapStoreState>((set) => ({
  activeCategory: 'all',
  selectedRoutePreview: null,
  setActiveCategory: (value) => set((state) => ({ activeCategory: resolveValue(value, state.activeCategory) })),
  setSelectedRoutePreview: (value) => set((state) => ({ selectedRoutePreview: resolveValue(value, state.selectedRoutePreview) })),
}));
