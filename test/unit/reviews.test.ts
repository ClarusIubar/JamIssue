import { describe, expect, it } from 'vitest';
import { countCommentsInThread, toReviewSummary } from '../../src/lib/reviews';
import { createReviewFixture } from '../fixtures/app-fixtures';

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
});
