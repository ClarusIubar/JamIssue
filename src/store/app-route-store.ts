import { create } from 'zustand';
import type { DrawerState, Tab } from '../types';
import { resolveValue, type SetterValue } from './store-utils';

type AppRouteStoreState = {
  activeTab: Tab;
  drawerState: DrawerState;
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  setActiveTab: (value: SetterValue<Tab>) => void;
  setDrawerState: (value: SetterValue<DrawerState>) => void;
  setSelectedPlaceId: (value: SetterValue<string | null>) => void;
  setSelectedFestivalId: (value: SetterValue<string | null>) => void;
};

export const useAppRouteStore = create<AppRouteStoreState>((set) => ({
  activeTab: 'map',
  drawerState: 'closed',
  selectedPlaceId: null,
  selectedFestivalId: null,
  setActiveTab: (value) => set((state) => ({ activeTab: resolveValue(value, state.activeTab) })),
  setDrawerState: (value) => set((state) => ({ drawerState: resolveValue(value, state.drawerState) })),
  setSelectedPlaceId: (value) => set((state) => ({ selectedPlaceId: resolveValue(value, state.selectedPlaceId) })),
  setSelectedFestivalId: (value) => set((state) => ({ selectedFestivalId: resolveValue(value, state.selectedFestivalId) })),
}));
