import { useEffect, useRef } from 'react';
import { CommentThread } from './CommentThread';
import { CommentIcon, HeartIcon } from './review/ReviewActionIcons';
import { ReviewFeedCardHeader } from './review/ReviewFeedCardHeader';
import { ReviewImageFrame } from './review/ReviewImageFrame';
import { ReviewTagRow } from './review/ReviewTagRow';
import type { Review } from '../types';

interface ReviewListProps {
  reviews: Review[];
  canWriteComment: boolean;
  canToggleLike: boolean;
  currentUserId?: string | null;
  highlightedReviewId?: string | null;
  likingReviewId: string | null;
  submittingReviewId: string | null;
  onToggleLike: (reviewId: string) => Promise<void>;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onUpdateComment: (reviewId: string, commentId: string, body: string) => Promise<void>;
  onDeleteComment: (reviewId: string, commentId: string) => Promise<void>;
  onDeleteReview?: (reviewId: string) => Promise<void>;
  onRequestLogin: () => void;
  onOpenPlace?: (placeId: string) => void;
  onOpenComments?: (reviewId: string) => void;
  emptyTitle: string;
  emptyBody: string;
}

export function ReviewList({
  reviews,
  canWriteComment,
  canToggleLike,
  currentUserId = null,
  highlightedReviewId = null,
  likingReviewId,
  submittingReviewId,
  onToggleLike,
  onSubmitComment,
  onUpdateComment,
  onDeleteComment,
  onDeleteReview,
  onRequestLogin,
  onOpenPlace,
  onOpenComments,
  emptyTitle,
  emptyBody,
}: ReviewListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!highlightedReviewId) {
      return;
    }

    const listEl = listRef.current;
    if (!listEl) {
      return;
    }

    const selector = `[data-review-id="${highlightedReviewId}"]`;
    const scrollToReview = () => {
      const target = listEl.querySelector<HTMLElement>(selector);
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    scrollToReview();
    const rafA = window.requestAnimationFrame(scrollToReview);
    const rafB = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToReview);
    });

    return () => {
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
    };
  }, [highlightedReviewId, reviews]);

  if (reviews.length === 0) {
    return (
      <section className="sheet-card stack-gap">
        <strong>{emptyTitle}</strong>
        <p className="section-copy">{emptyBody}</p>
      </section>
    );
  }

  return (
    <div ref={listRef} className="review-stack">
      {reviews.map((review) => (
        <article
          key={review.id}
          data-review-id={review.id}
          className={review.id === highlightedReviewId ? 'review-card review-card--feed review-card--highlighted' : 'review-card review-card--feed'}
        >
          <ReviewFeedCardHeader
            title={<strong className="review-card__title">{review.placeName}</strong>}
            mood={review.mood}
            meta={`${review.author} · ${review.visitedAt}`}
          />

          <ReviewTagRow visitLabel={review.visitLabel} badge={review.badge} hasPublishedRoute={review.hasPublishedRoute} />

          {review.imageUrl && <ReviewImageFrame src={review.imageUrl} alt={`${review.placeName} 후기 이미지`} />}

          <p className="review-card__body">{review.body}</p>

          <div className="review-card__actions review-card__actions--feed">
            <div className="review-card__action-group review-card__action-group--feed">
              <button
                type="button"
                className={review.likedByMe ? 'review-action-button is-active' : 'review-action-button'}
                disabled={likingReviewId === review.id}
                onClick={() => (canToggleLike ? onToggleLike(review.id) : onRequestLogin())}
                aria-pressed={review.likedByMe}
              >
                <span className="review-action-button__icon" aria-hidden="true">
                  <HeartIcon filled={review.likedByMe} />
                </span>
                <span className="review-action-button__label">{review.likeCount}</span>
              </button>
              {onOpenComments ? (
                <button
                  type="button"
                  className="review-action-button"
                  onClick={() => onOpenComments(review.id)}
                  aria-label={`댓글 ${review.commentCount}개`}
                >
                  <span className="review-action-button__icon" aria-hidden="true">
                    <CommentIcon />
                  </span>
                  <span className="review-action-button__label">{review.commentCount}</span>
                </button>
              ) : (
                <span className="review-action-button review-action-button--static" aria-hidden="true">
                  <span className="review-action-button__icon">
                    <CommentIcon />
                  </span>
                  <span className="review-action-button__label">{review.commentCount}</span>
                </span>
              )}
            </div>
            {onOpenPlace && (
              <button type="button" className="review-link-button" onClick={() => onOpenPlace(review.placeId)}>
                이 장소 보기
              </button>
            )}
          </div>

          {!onOpenComments && (
            <CommentThread
              comments={review.comments}
              canWriteComment={canWriteComment}
              currentUserId={currentUserId}
              submittingReviewId={submittingReviewId}
              mutatingCommentId={null}
              highlightedCommentId={null}
              reviewId={review.id}
              onSubmitComment={onSubmitComment}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              onRequestLogin={onRequestLogin}
            />
          )}
        </article>
      ))}
    </div>
  );
}
