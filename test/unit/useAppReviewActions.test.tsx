import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyPageResponse, Review } from '../../src/types';
import { useActiveReviewComments } from '../../src/hooks/useActiveReviewComments';
import { useAppReviewActions } from '../../src/hooks/useAppReviewActions';
import { useAppRuntimeStore } from '../../src/store/app-runtime-store';
import { useReviewUIStore } from '../../src/store/review-ui-store';
import { createReviewFixture, myPageFixture, placeFixture, sessionUserFixture } from '../fixtures/app-fixtures';

vi.mock('../../src/api/client', () => ({
  createComment: vi.fn(),
  createReview: vi.fn(),
  deleteComment: vi.fn(),
  deleteReview: vi.fn(),
  getReviewComments: vi.fn(),
  toggleReviewLike: vi.fn(),
  updateComment: vi.fn(),
  updateReview: vi.fn(),
  uploadReviewImage: vi.fn(),
}));

import { getReviewComments, updateReview } from '../../src/api/client';

describe('useAppReviewActions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getReviewComments).mockResolvedValue([]);
    useAppRuntimeStore.setState({
      reviewSubmitting: false,
      reviewError: null,
      reviewLikeUpdatingId: null,
      commentSubmittingReviewId: null,
      commentMutatingId: null,
      deletingReviewId: null,
    });
    useReviewUIStore.setState({
      highlightedReviewId: null,
    });
  });

  it('keeps my-page reviews summarized after editing a review', async () => {
    const existingReview = createReviewFixture({
      id: 'review-99',
      comments: [],
      commentCount: 0,
      body: '수정 전 본문',
    });
    const updatedReview = createReviewFixture({
      id: existingReview.id,
      body: '수정 후 본문',
      commentCount: 2,
      comments: [
        {
          id: 'comment-embedded',
          userId: 'user-2',
          author: '댓글 작성자',
          body: '응답이 붙은 댓글',
          parentId: null,
          isDeleted: false,
          createdAt: '03. 29. 11:20',
          replies: [],
        },
      ],
    });
    vi.mocked(updateReview).mockResolvedValue(updatedReview);

    let myPageState: MyPageResponse | null = {
      ...myPageFixture,
      reviews: [existingReview],
      comments: [
        {
          ...myPageFixture.comments[0],
          reviewId: existingReview.id,
          reviewBody: existingReview.body,
        },
      ],
    };
    let patchedReview: Review | null = null;

    const patchReviewCollections = vi.fn((reviewId: string, updater: (review: Review) => Review) => {
      patchedReview = updater(existingReview);
    });
    const setMyPage = vi.fn((nextValue: MyPageResponse | null | ((current: MyPageResponse | null) => MyPageResponse | null)) => {
      myPageState = typeof nextValue === 'function' ? nextValue(myPageState) : nextValue;
    });

    const { result } = renderHook(() => useAppReviewActions({
      activeTab: 'my',
      sessionUser: sessionUserFixture,
      selectedPlace: placeFixture,
      reviews: [existingReview],
      selectedPlaceReviews: [existingReview],
      myPage: myPageState,
      activeCommentReviewId: null,
      highlightedReviewId: null,
      setSelectedPlaceReviews: vi.fn(),
      setReviews: vi.fn(),
      setMyPage,
      setNotice: vi.fn(),
      goToTab: vi.fn(),
      commitRouteState: vi.fn(),
      refreshMyPageForUser: vi.fn(),
      patchReviewCollections,
      upsertReviewCollections: vi.fn(),
      placeReviewsCacheRef: { current: {} },
      handleCloseReviewComments: vi.fn(),
      syncReviewComments: vi.fn(),
      clearReviewComments: vi.fn(),
      formatErrorMessage: (error) => String(error),
    }));

    await act(async () => {
      await result.current.handleUpdateReview(existingReview.id, {
        body: '수정 후 본문',
        mood: existingReview.mood,
      });
    });

    expect(updateReview).toHaveBeenCalledWith(existingReview.id, {
      body: '수정 후 본문',
      mood: existingReview.mood,
      imageUrl: undefined,
    });
    expect(patchReviewCollections).toHaveBeenCalledTimes(1);
    expect(patchedReview).toEqual({
      ...updatedReview,
      comments: [],
    });
    expect(myPageState?.reviews).toEqual([
      {
        ...updatedReview,
        comments: [],
      },
    ]);
    expect(myPageState?.comments[0]?.reviewBody).toBe('수정 후 본문');
  });

  it('reuses cached active comments while refreshing the thread in the background', async () => {
    const refreshedComments = [{ ...myPageFixture.reviews[0].comments[0], body: '?덈줈怨좎묠???볤?' }];
    const setNotice = vi.fn();
    const formatErrorMessage = (error: unknown) => String(error);
    vi.mocked(getReviewComments)
      .mockResolvedValueOnce(myPageFixture.reviews[0].comments)
      .mockResolvedValueOnce(refreshedComments);

    const { result, rerender } = renderHook(
      ({ reviewId }) => useActiveReviewComments({
        activeCommentReviewId: reviewId,
        setNotice,
        formatErrorMessage,
      }),
      { initialProps: { reviewId: 'review-1' as string | null } },
    );

    await waitFor(() => {
      expect(result.current.activeReviewCommentsStatus).toBe('ready');
    });
    expect(result.current.activeReviewComments).toEqual(myPageFixture.reviews[0].comments);

    rerender({ reviewId: null });
    expect(result.current.activeReviewCommentsStatus).toBe('idle');

    rerender({ reviewId: 'review-1' });
    expect(result.current.activeReviewCommentsStatus).toBe('ready');
    expect(result.current.activeReviewComments).toEqual(myPageFixture.reviews[0].comments);

    await waitFor(() => {
      expect(result.current.activeReviewComments).toEqual(refreshedComments);
    });
    expect(getReviewComments).toHaveBeenCalledTimes(2);
  });

  it('reports loading errors for uncached active comment threads', async () => {
    const setNotice = vi.fn();
    const formatErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
    vi.mocked(getReviewComments).mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useActiveReviewComments({
      activeCommentReviewId: 'review-1',
      setNotice,
      formatErrorMessage,
    }));

    await waitFor(() => {
      expect(result.current.activeReviewCommentsStatus).toBe('error');
    });
    expect(setNotice).toHaveBeenCalledWith('boom');
  });
});
