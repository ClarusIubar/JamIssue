import { create } from 'zustand';
import { resolveValue, type SetterValue } from './store-utils';

type ReviewUIState = {
  feedPlaceFilterId: string | null;
  activeCommentReviewId: string | null;
  highlightedCommentId: string | null;
  highlightedReviewId: string | null;
  highlightedRouteId: string | null;
  setFeedPlaceFilterId: (value: SetterValue<string | null>) => void;
  setActiveCommentReviewId: (value: SetterValue<string | null>) => void;
  setHighlightedCommentId: (value: SetterValue<string | null>) => void;
  setHighlightedReviewId: (value: SetterValue<string | null>) => void;
  setHighlightedRouteId: (value: SetterValue<string | null>) => void;
};

export const useReviewUIStore = create<ReviewUIState>((set) => ({
  feedPlaceFilterId: null,
  activeCommentReviewId: null,
  highlightedCommentId: null,
  highlightedReviewId: null,
  highlightedRouteId: null,
  setFeedPlaceFilterId: (value) => set((state) => ({ feedPlaceFilterId: resolveValue(value, state.feedPlaceFilterId) })),
  setActiveCommentReviewId: (value) => set((state) => ({ activeCommentReviewId: resolveValue(value, state.activeCommentReviewId) })),
  setHighlightedCommentId: (value) => set((state) => ({ highlightedCommentId: resolveValue(value, state.highlightedCommentId) })),
  setHighlightedReviewId: (value) => set((state) => ({ highlightedReviewId: resolveValue(value, state.highlightedReviewId) })),
  setHighlightedRouteId: (value) => set((state) => ({ highlightedRouteId: resolveValue(value, state.highlightedRouteId) })),
}));
