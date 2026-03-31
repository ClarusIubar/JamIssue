import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewList } from '../../src/components/ReviewList';
import { createReviewFixture } from '../fixtures/app-fixtures';

describe('ReviewList regression', () => {
  it('uses commentCount for the feed action badge even when the thread is not embedded', () => {
    const onToggleLike = vi.fn().mockResolvedValue(undefined);
    const onOpenPlace = vi.fn();
    const onOpenComments = vi.fn();
    const review = createReviewFixture({
      commentCount: 4,
      comments: [],
    });

    const { container, getByRole } = render(
      <ReviewList
        reviews={[review]}
        canWriteComment={true}
        canToggleLike={true}
        currentUserId="user-1"
        highlightedReviewId={review.id}
        likingReviewId={null}
        submittingReviewId={null}
        onToggleLike={onToggleLike}
        onSubmitComment={vi.fn().mockResolvedValue(undefined)}
        onUpdateComment={vi.fn().mockResolvedValue(undefined)}
        onDeleteComment={vi.fn().mockResolvedValue(undefined)}
        onRequestLogin={vi.fn()}
        onOpenPlace={onOpenPlace}
        onOpenComments={onOpenComments}
        emptyTitle="비어 있음"
        emptyBody="내용 없음"
      />,
    );

    const article = container.querySelector(`[data-review-id="${review.id}"]`);
    expect(article).toHaveClass('review-card--highlighted');
    expect(article).toHaveClass('review-card--feed');

    fireEvent.click(getByRole('button', { name: String(review.likeCount) }));
    expect(onToggleLike).toHaveBeenCalledWith(review.id);

    fireEvent.click(getByRole('button', { name: '댓글 4개' }));
    expect(onOpenComments).toHaveBeenCalledWith(review.id);

    fireEvent.click(getByRole('button', { name: '이 장소 보기' }));
    expect(onOpenPlace).toHaveBeenCalledWith(review.placeId);
  });
});
