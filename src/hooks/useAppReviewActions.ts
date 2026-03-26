import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  createComment,
  createReview,
  deleteComment,
  deleteReview,
  toggleReviewLike,
  updateComment,
  updateReview,
  uploadReviewImage,
} from '../api/client';
import type {
  DrawerState,
  MyPageResponse,
  Place,
  Review,
  ReviewMood,
  SessionUser,
  Tab,
} from '../types';

type SetState<T> = Dispatch<SetStateAction<T>>;
type HistoryMode = 'push' | 'replace';

interface UseAppReviewActionsParams {
  activeTab: Tab;
  sessionUser: SessionUser | null;
  selectedPlace: Place | null;
  reviews: Review[];
  selectedPlaceReviews: Review[];
  myPage: MyPageResponse | null;
  activeCommentReviewId: string | null;
  highlightedReviewId: string | null;
  setReviewSubmitting: SetState<boolean>;
  setReviewError: SetState<string | null>;
  setCommentSubmittingReviewId: SetState<string | null>;
  setCommentMutatingId: SetState<string | null>;
  setDeletingReviewId: SetState<string | null>;
  setReviewLikeUpdatingId: SetState<string | null>;
  setSelectedPlaceReviews: SetState<Review[]>;
  setReviews: SetState<Review[]>;
  setMyPage: SetState<MyPageResponse | null>;
  setNotice: (notice: string | null) => void;
  setHighlightedReviewId: (reviewId: string | null) => void;
  goToTab: (nextTab: Tab, historyMode?: HistoryMode) => void;
  commitRouteState: (
    nextState: { tab: Tab; placeId: string | null; festivalId: string | null; drawerState: DrawerState },
    historyMode?: HistoryMode,
  ) => void;
  refreshMyPageForUser: (user: SessionUser | null, force?: boolean) => Promise<MyPageResponse | null>;
  patchReviewCollections: (reviewId: string, updater: (review: Review) => Review) => void;
  upsertReviewCollections: (review: Review) => void;
  placeReviewsCacheRef: MutableRefObject<Record<string, Review[]>>;
  handleCloseReviewComments: () => void;
  formatErrorMessage: (error: unknown) => string;
}

export function useAppReviewActions({
  activeTab,
  sessionUser,
  selectedPlace,
  reviews,
  selectedPlaceReviews,
  myPage,
  activeCommentReviewId,
  highlightedReviewId,
  setReviewSubmitting,
  setReviewError,
  setCommentSubmittingReviewId,
  setCommentMutatingId,
  setDeletingReviewId,
  setReviewLikeUpdatingId,
  setSelectedPlaceReviews,
  setReviews,
  setMyPage,
  setNotice,
  setHighlightedReviewId,
  goToTab,
  commitRouteState,
  refreshMyPageForUser,
  patchReviewCollections,
  upsertReviewCollections,
  placeReviewsCacheRef,
  handleCloseReviewComments,
  formatErrorMessage,
}: UseAppReviewActionsParams) {
  async function handleCreateReview(payload: { stampId: string; body: string; mood: ReviewMood; file: File | null }) {
    if (!sessionUser || !selectedPlace) {
      goToTab('my');
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);
    try {
      let imageUrl: string | null = null;
      if (payload.file) {
        const uploaded = await uploadReviewImage(payload.file);
        imageUrl = uploaded.url;
      }
      const createdReview = await createReview({
        placeId: selectedPlace.id,
        stampId: payload.stampId,
        body: payload.body.trim(),
        mood: payload.mood,
        imageUrl,
      });
      upsertReviewCollections(createdReview);
      await refreshMyPageForUser(sessionUser);
      setNotice('피드를 남겼어요. 이제 다른 장소도 이어서 둘러볼 수 있어요.');
      commitRouteState(
        {
          tab: 'map',
          placeId: selectedPlace.id,
          festivalId: null,
          drawerState: 'full',
        },
        'replace',
      );
    } catch (error) {
      setReviewError(formatErrorMessage(error));
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleUpdateReview(reviewId: string, payload: { body: string; mood: ReviewMood }) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('피드를 수정하려면 먼저 로그인해 주세요.');
      return;
    }

    const updatedReview = await updateReview(reviewId, {
      body: payload.body.trim(),
      mood: payload.mood,
    });
    patchReviewCollections(reviewId, () => updatedReview);
    setMyPage((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        reviews: current.reviews.map((review) => (review.id === reviewId ? updatedReview : review)),
        comments: current.comments.map((comment) => (
          comment.reviewId === reviewId
            ? { ...comment, reviewBody: updatedReview.body }
            : comment
        )),
      };
    });
    setNotice('피드를 수정했어요.');
  }

  async function handleCreateComment(reviewId: string, body: string, parentId?: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('댓글을 남기려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentSubmittingReviewId(reviewId);
    try {
      const updatedComments = await createComment(reviewId, { body, parentId: parentId ?? null });
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        comments: updatedComments,
        commentCount: updatedComments.length,
      }));
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentSubmittingReviewId(null);
    }
  }

  async function handleUpdateComment(reviewId: string, commentId: string, body: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('댓글을 수정하려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentMutatingId(commentId);
    try {
      const updatedComments = await updateComment(reviewId, commentId, { body });
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        comments: updatedComments,
        commentCount: updatedComments.length,
      }));
      if (activeTab === 'my') {
        await refreshMyPageForUser(sessionUser, true);
      }
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentMutatingId(null);
    }
  }

  async function handleDeleteComment(reviewId: string, commentId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('댓글을 삭제하려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentMutatingId(commentId);
    try {
      const updatedComments = await deleteComment(reviewId, commentId);
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        comments: updatedComments,
        commentCount: updatedComments.length,
      }));
      if (activeTab === 'my') {
        await refreshMyPageForUser(sessionUser, true);
      }
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentMutatingId(null);
    }
  }

  async function handleDeleteReview(reviewId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('피드를 삭제하려면 먼저 로그인해 주세요.');
      return;
    }
    if (!window.confirm('이 피드를 삭제할까요?')) {
      return;
    }

    setDeletingReviewId(reviewId);
    try {
      await deleteReview(reviewId);
      setReviews((current) => current.filter((review) => review.id !== reviewId));
      setSelectedPlaceReviews((current) => current.filter((review) => review.id !== reviewId));
      for (const placeId of Object.keys(placeReviewsCacheRef.current)) {
        placeReviewsCacheRef.current[placeId] = placeReviewsCacheRef.current[placeId].filter((review) => review.id !== reviewId);
      }
      setMyPage((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          reviews: current.reviews.filter((review) => review.id !== reviewId),
          comments: current.comments.filter((comment) => comment.reviewId !== reviewId),
          stats: {
            ...current.stats,
            reviewCount: Math.max(0, current.stats.reviewCount - 1),
          },
        };
      });
      if (activeCommentReviewId === reviewId) {
        handleCloseReviewComments();
      }
      if (highlightedReviewId === reviewId) {
        setHighlightedReviewId(null);
      }
      setNotice('피드를 삭제했어요.');
      if (activeTab === 'my') {
        await refreshMyPageForUser(sessionUser, true);
      }
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setDeletingReviewId(null);
    }
  }

  async function handleToggleReviewLike(reviewId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('좋아요를 누르려면 먼저 로그인해 주세요.');
      return;
    }

    const targetReview = reviews.find((review) => review.id === reviewId)
      ?? selectedPlaceReviews.find((review) => review.id === reviewId)
      ?? myPage?.reviews.find((review) => review.id === reviewId)
      ?? null;
    const previousLikedByMe = targetReview?.likedByMe ?? false;
    const previousLikeCount = targetReview?.likeCount ?? 0;
    const optimisticLikedByMe = !previousLikedByMe;
    const optimisticLikeCount = Math.max(0, previousLikeCount + (optimisticLikedByMe ? 1 : -1));

    patchReviewCollections(reviewId, (review) => ({
      ...review,
      likeCount: optimisticLikeCount,
      likedByMe: optimisticLikedByMe,
    }));

    setReviewLikeUpdatingId(reviewId);
    try {
      const result = await toggleReviewLike(reviewId);
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        likeCount: result.likeCount,
        likedByMe: result.likedByMe,
      }));
    } catch (error) {
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        likeCount: previousLikeCount,
        likedByMe: previousLikedByMe,
      }));
      setNotice(formatErrorMessage(error));
    } finally {
      setReviewLikeUpdatingId(null);
    }
  }

  return {
    handleCreateReview,
    handleUpdateReview,
    handleCreateComment,
    handleUpdateComment,
    handleDeleteComment,
    handleDeleteReview,
    handleToggleReviewLike,
  };
}
