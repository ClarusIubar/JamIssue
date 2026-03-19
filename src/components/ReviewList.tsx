import { CommentThread } from './CommentThread';
import type { Review } from '../types';

interface ReviewListProps {
  reviews: Review[];
  canWriteComment: boolean;
  canToggleLike: boolean;
  likingReviewId: string | null;
  submittingReviewId: string | null;
  onToggleLike: (reviewId: string) => Promise<void>;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
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
  likingReviewId,
  submittingReviewId,
  onToggleLike,
  onSubmitComment,
  onRequestLogin,
  onOpenPlace,
  onOpenComments,
  emptyTitle,
  emptyBody,
}: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <section className="sheet-card stack-gap">
        <strong>{emptyTitle}</strong>
        <p className="section-copy">{emptyBody}</p>
      </section>
    );
  }

  return (
    <div className="review-stack">
      {reviews.map((review) => (
        <article key={review.id} className="review-card">
          <div className="review-card__top review-card__top--feed">
            <div className="review-card__title-block review-card__title-block--feed">
              <p className="eyebrow">{review.mood}</p>
              <strong className="review-card__title">{review.placeName}</strong>
              <p className="review-card__author-line">
                {review.author} · {review.visitLabel} · {review.visitedAt}
              </p>
            </div>
          </div>

          <div className="review-card__tag-row">
            <span className="review-card__visit-pill">{review.visitLabel}</span>
            {review.travelSessionId && <span className="soft-tag">연속 여행 기록</span>}
            <span className="soft-tag">{review.badge}</span>
          </div>

          <p className="review-card__body">{review.body}</p>

          {review.imageUrl && <img className="review-card__image" src={review.imageUrl} alt={`${review.placeName} 후기 이미지`} />}

          <div className="review-card__actions">
            <div className="review-card__action-group">
              <button
                type="button"
                className={review.likedByMe ? 'review-action-button is-active' : 'review-action-button'}
                disabled={likingReviewId === review.id}
                onClick={() => (canToggleLike ? onToggleLike(review.id) : onRequestLogin())}
                aria-pressed={review.likedByMe}
              >
                <span className="review-action-button__icon" aria-hidden="true">
                  {review.likedByMe ? '♥' : '♡'}
                </span>
                <span className="review-action-button__label">{likingReviewId === review.id ? '반영 중' : review.likeCount}</span>
              </button>
              {onOpenComments ? (
                <button
                  type="button"
                  className="review-action-button"
                  onClick={() => onOpenComments(review.id)}
                  aria-label={`댓글 ${review.comments.length}개`}
                >
                  <span className="review-action-button__icon">💬</span>
                  <span className="review-action-button__label">{review.comments.length}</span>
                </button>
              ) : (
                <span className="review-action-button review-action-button--static" aria-hidden="true">
                  <span className="review-action-button__icon">💬</span>
                  <span className="review-action-button__label">{review.comments.length}</span>
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
              submittingReviewId={submittingReviewId}
              highlightedCommentId={null}
              reviewId={review.id}
              onSubmitComment={onSubmitComment}
              onRequestLogin={onRequestLogin}
            />
          )}
        </article>
      ))}
    </div>
  );
}
