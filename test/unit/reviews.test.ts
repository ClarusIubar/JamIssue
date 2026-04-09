import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppDataState } from '../../src/hooks/useAppDataState';
import { countCommentsInThread, toReviewSummary } from '../../src/lib/reviews';
import { commentFixture, createReviewFixture } from '../fixtures/app-fixtures';

describe('review helpers', () => {
  it('counts nested comments across the whole thread', () => {
    const review = createReviewFixture({
      commentCount: 3,
      comments: [
        {
          id: 'comment-1',
          userId: 'user-1',
          author: '작성자',
          body: '루트 댓글',
          parentId: null,
          isDeleted: false,
          createdAt: '03. 28. 09:10',
          replies: [
            {
              id: 'comment-2',
              userId: 'user-2',
              author: '답글 작성자',
              body: '첫 답글',
              parentId: 'comment-1',
              isDeleted: false,
              createdAt: '03. 28. 09:20',
              replies: [],
            },
            {
              id: 'comment-3',
              userId: 'user-3',
              author: '두 번째 답글 작성자',
              body: '두 번째 답글',
              parentId: 'comment-1',
              isDeleted: false,
              createdAt: '03. 28. 09:30',
              replies: [],
            },
          ],
        },
      ],
    });

    expect(countCommentsInThread(review.comments)).toBe(3);
  });

  it('strips embedded comments from feed review summaries', () => {
    const review = createReviewFixture();

    expect(toReviewSummary(review)).toEqual({
      ...review,
      comments: [],
    });
  });

  it('keeps upserted review collections summary-only', () => {
    const detailedReview = createReviewFixture({
      id: 'review-upsert',
      comments: [commentFixture],
      commentCount: 1,
    });

    const { result } = renderHook(() => useAppDataState(detailedReview.placeId));

    act(() => {
      result.current.upsertReviewCollections(detailedReview);
    });

    expect(result.current.reviews[0]).toEqual({
      ...detailedReview,
      comments: [],
    });
    expect(result.current.selectedPlaceReviews[0]).toEqual({
      ...detailedReview,
      comments: [],
    });
    expect(result.current.placeReviewsCacheRef.current[detailedReview.placeId]?.[0]).toEqual({
      ...detailedReview,
      comments: [],
    });
  });

  it('keeps patched review collections summary-only even when updater returns embedded comments', () => {
    const baseReview = createReviewFixture({
      id: 'review-patch',
      comments: [],
      commentCount: 0,
    });
    const embeddedComments = [{ ...commentFixture, id: 'comment-2' }];

    const { result } = renderHook(() => useAppDataState(baseReview.placeId));

    act(() => {
      result.current.upsertReviewCollections(baseReview);
      result.current.patchReviewCollections(baseReview.id, (review) => ({
        ...review,
        body: '수정된 본문',
        commentCount: 1,
        comments: embeddedComments,
      }));
    });

    expect(result.current.reviews[0]).toEqual({
      ...baseReview,
      body: '수정된 본문',
      commentCount: 1,
      comments: [],
    });
    expect(result.current.selectedPlaceReviews[0]?.comments).toEqual([]);
    expect(result.current.placeReviewsCacheRef.current[baseReview.placeId]?.[0]?.comments).toEqual([]);
  });
});
