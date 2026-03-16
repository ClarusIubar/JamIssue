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
}: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <article className="review-card review-card--empty">
        <strong>아직 남겨진 후기가 없어요.</strong>
        <p>첫 후기 한 줄이 다음 사람의 대전 코스를 바꿔 줄 수 있어요.</p>
      </article>
    );
  }

  return (
    <div className="review-stack">
      {reviews.map((review) => (
        <article key={review.id} className="review-card">
          <div className="review-card__top">
            <div>
              <strong>{review.author}</strong>
              <p>
                {review.badge} / {review.visitedAt}
              </p>
            </div>
            <span className="mood-pill">{review.mood}</span>
          </div>
          <p className="review-card__body">{review.body}</p>
          {review.imageUrl && <img className="review-card__image" src={review.imageUrl} alt={`${review.placeName} 후기 사진`} />}
          <div className="review-card__actions">
            <button
              type="button"
              className={review.likedByMe ? 'text-button review-action-button is-active' : 'text-button review-action-button'}
              onClick={() => (canToggleLike ? onToggleLike(review.id) : onRequestLogin())}
              disabled={likingReviewId === review.id}
            >
              {likingReviewId === review.id ? '반영 중' : `좋아요 ${review.likeCount}`}
            </button>
            <span className="review-action-copy">댓글 {review.commentCount}</span>
          </div>
          <CommentThread
            reviewId={review.id}
            comments={review.comments}
            canWrite={canWriteComment}
            submitting={submittingReviewId === review.id}
            onSubmit={onSubmitComment}
            onRequestLogin={onRequestLogin}
          />
        </article>
      ))}
    </div>
  );
}
