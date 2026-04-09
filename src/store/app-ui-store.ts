import { create } from 'zustand';
import type { DrawerState, MyPageTabKey, Tab } from '../types';
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
  returnView: ReturnViewState | null;
  setReturnView: (value: SetterValue<ReturnViewState | null>) => void;
};

export const useAppUIStore = create<AppUIState>((set) => ({
  returnView: null,
  setReturnView: (value) => set((state) => ({ returnView: resolveValue(value, state.returnView) })),
}));
