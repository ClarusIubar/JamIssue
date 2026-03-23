import { create } from 'zustand';
import type { ApiStatus } from '../types';

type SetterValue<T> = T | ((current: T) => T);

function resolveValue<T>(value: SetterValue<T>, current: T): T {
  return typeof value === 'function' ? (value as (current: T) => T)(current) : value;
}

type Position = { latitude: number; longitude: number } | null;

type AppRuntimeState = {
  notice: string | null;
  currentPosition: Position;
  mapLocationStatus: ApiStatus;
  mapLocationMessage: string | null;
  mapLocationFocusKey: number;
  reviewSubmitting: boolean;
  reviewError: string | null;
  reviewLikeUpdatingId: string | null;
  commentSubmittingReviewId: string | null;
  commentMutatingId: string | null;
  deletingReviewId: string | null;
  stampActionStatus: ApiStatus;
  stampActionMessage: string;
  routeSubmitting: boolean;
  routeError: string | null;
  routeLikeUpdatingId: string | null;
  profileSaving: boolean;
  profileError: string | null;
  myPageError: string | null;
  isLoggingOut: boolean;
  feedNextCursor: string | null;
  feedHasMore: boolean;
  feedLoadingMore: boolean;
  myCommentsNextCursor: string | null;
  myCommentsHasMore: boolean;
  myCommentsLoadingMore: boolean;
  myCommentsLoadedOnce: boolean;
  setNotice: (value: SetterValue<string | null>) => void;
  setCurrentPosition: (value: SetterValue<Position>) => void;
  setMapLocationStatus: (value: SetterValue<ApiStatus>) => void;
  setMapLocationMessage: (value: SetterValue<string | null>) => void;
  setMapLocationFocusKey: (value: SetterValue<number>) => void;
  setReviewSubmitting: (value: SetterValue<boolean>) => void;
  setReviewError: (value: SetterValue<string | null>) => void;
  setReviewLikeUpdatingId: (value: SetterValue<string | null>) => void;
  setCommentSubmittingReviewId: (value: SetterValue<string | null>) => void;
  setCommentMutatingId: (value: SetterValue<string | null>) => void;
  setDeletingReviewId: (value: SetterValue<string | null>) => void;
  setStampActionStatus: (value: SetterValue<ApiStatus>) => void;
  setStampActionMessage: (value: SetterValue<string>) => void;
  setRouteSubmitting: (value: SetterValue<boolean>) => void;
  setRouteError: (value: SetterValue<string | null>) => void;
  setRouteLikeUpdatingId: (value: SetterValue<string | null>) => void;
  setProfileSaving: (value: SetterValue<boolean>) => void;
  setProfileError: (value: SetterValue<string | null>) => void;
  setMyPageError: (value: SetterValue<string | null>) => void;
  setIsLoggingOut: (value: SetterValue<boolean>) => void;
  setFeedNextCursor: (value: SetterValue<string | null>) => void;
  setFeedHasMore: (value: SetterValue<boolean>) => void;
  setFeedLoadingMore: (value: SetterValue<boolean>) => void;
  setMyCommentsNextCursor: (value: SetterValue<string | null>) => void;
  setMyCommentsHasMore: (value: SetterValue<boolean>) => void;
  setMyCommentsLoadingMore: (value: SetterValue<boolean>) => void;
  setMyCommentsLoadedOnce: (value: SetterValue<boolean>) => void;
};

export const useAppRuntimeStore = create<AppRuntimeState>((set) => ({
  notice: null,
  currentPosition: null,
  mapLocationStatus: 'idle',
  mapLocationMessage: null,
  mapLocationFocusKey: 0,
  reviewSubmitting: false,
  reviewError: null,
  reviewLikeUpdatingId: null,
  commentSubmittingReviewId: null,
  commentMutatingId: null,
  deletingReviewId: null,
  stampActionStatus: 'idle',
  stampActionMessage: '장소를 선택하면 오늘 스탬프 가능 여부를 바로 확인할 수 있어요.',
  routeSubmitting: false,
  routeError: null,
  routeLikeUpdatingId: null,
  profileSaving: false,
  profileError: null,
  myPageError: null,
  isLoggingOut: false,
  feedNextCursor: null,
  feedHasMore: false,
  feedLoadingMore: false,
  myCommentsNextCursor: null,
  myCommentsHasMore: false,
  myCommentsLoadingMore: false,
  myCommentsLoadedOnce: false,
  setNotice: (value) => set((state) => ({ notice: resolveValue(value, state.notice) })),
  setCurrentPosition: (value) => set((state) => ({ currentPosition: resolveValue(value, state.currentPosition) })),
  setMapLocationStatus: (value) => set((state) => ({ mapLocationStatus: resolveValue(value, state.mapLocationStatus) })),
  setMapLocationMessage: (value) => set((state) => ({ mapLocationMessage: resolveValue(value, state.mapLocationMessage) })),
  setMapLocationFocusKey: (value) => set((state) => ({ mapLocationFocusKey: resolveValue(value, state.mapLocationFocusKey) })),
  setReviewSubmitting: (value) => set((state) => ({ reviewSubmitting: resolveValue(value, state.reviewSubmitting) })),
  setReviewError: (value) => set((state) => ({ reviewError: resolveValue(value, state.reviewError) })),
  setReviewLikeUpdatingId: (value) => set((state) => ({ reviewLikeUpdatingId: resolveValue(value, state.reviewLikeUpdatingId) })),
  setCommentSubmittingReviewId: (value) => set((state) => ({ commentSubmittingReviewId: resolveValue(value, state.commentSubmittingReviewId) })),
  setCommentMutatingId: (value) => set((state) => ({ commentMutatingId: resolveValue(value, state.commentMutatingId) })),
  setDeletingReviewId: (value) => set((state) => ({ deletingReviewId: resolveValue(value, state.deletingReviewId) })),
  setStampActionStatus: (value) => set((state) => ({ stampActionStatus: resolveValue(value, state.stampActionStatus) })),
  setStampActionMessage: (value) => set((state) => ({ stampActionMessage: resolveValue(value, state.stampActionMessage) })),
  setRouteSubmitting: (value) => set((state) => ({ routeSubmitting: resolveValue(value, state.routeSubmitting) })),
  setRouteError: (value) => set((state) => ({ routeError: resolveValue(value, state.routeError) })),
  setRouteLikeUpdatingId: (value) => set((state) => ({ routeLikeUpdatingId: resolveValue(value, state.routeLikeUpdatingId) })),
  setProfileSaving: (value) => set((state) => ({ profileSaving: resolveValue(value, state.profileSaving) })),
  setProfileError: (value) => set((state) => ({ profileError: resolveValue(value, state.profileError) })),
  setMyPageError: (value) => set((state) => ({ myPageError: resolveValue(value, state.myPageError) })),
  setIsLoggingOut: (value) => set((state) => ({ isLoggingOut: resolveValue(value, state.isLoggingOut) })),
  setFeedNextCursor: (value) => set((state) => ({ feedNextCursor: resolveValue(value, state.feedNextCursor) })),
  setFeedHasMore: (value) => set((state) => ({ feedHasMore: resolveValue(value, state.feedHasMore) })),
  setFeedLoadingMore: (value) => set((state) => ({ feedLoadingMore: resolveValue(value, state.feedLoadingMore) })),
  setMyCommentsNextCursor: (value) => set((state) => ({ myCommentsNextCursor: resolveValue(value, state.myCommentsNextCursor) })),
  setMyCommentsHasMore: (value) => set((state) => ({ myCommentsHasMore: resolveValue(value, state.myCommentsHasMore) })),
  setMyCommentsLoadingMore: (value) => set((state) => ({ myCommentsLoadingMore: resolveValue(value, state.myCommentsLoadingMore) })),
  setMyCommentsLoadedOnce: (value) => set((state) => ({ myCommentsLoadedOnce: resolveValue(value, state.myCommentsLoadedOnce) })),
}));
