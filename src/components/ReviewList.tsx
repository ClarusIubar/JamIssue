import { useEffect, useRef, useState } from 'react';
import { CommentThread } from './CommentThread';
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="review-action-button__svg" aria-hidden="true">
      <path
        d="M12 21s-6.716-4.309-9.193-8.19C1.25 10.387 2.17 6.9 5.41 5.61c1.98-.788 4.183-.145 5.59 1.495 1.408-1.64 3.611-2.283 5.59-1.495 3.24 1.29 4.16 4.777 2.603 7.2C18.716 16.691 12 21 12 21Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="review-action-button__svg" aria-hidden="true">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReviewImageFrame({ src, alt }: { src: string; alt: string }) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [isTall, setIsTall] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateFrameSize = () => {
      if (frameRef.current) {
        setFrameSize({
          width: frameRef.current.clientWidth || 0,
          height: frameRef.current.clientHeight || 0,
        });
      }
    };

    updateFrameSize();
    window.addEventListener('resize', updateFrameSize);
    return () => {
      window.removeEventListener('resize', updateFrameSize);
    };
  }, []);

  return (
    <div
      ref={frameRef}
      className="review-card__image-frame"
      style={{
        width: '100%',
        height: 'min(220px, 56vw)',
        maxHeight: '220px',
        borderRadius: '20px',
        overflow: 'hidden',
        background: 'rgba(255, 250, 252, 0.96)',
        border: '1px solid rgba(255, 176, 201, 0.16)',
        padding: '0',
        position: 'relative',
      }}
    >
      {isTall ? (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: `${Math.max(frameSize.height, 1)}px`,
            height: `${Math.max(frameSize.width, 1)}px`,
            transform: 'translate(-50%, -50%) rotate(-90deg)',
            transformOrigin: 'center center',
            overflow: 'hidden',
            borderRadius: '14px',
          }}
        >
          <img
            className="review-card__image"
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={(event) => {
              const target = event.currentTarget;
              setIsTall(target.naturalHeight > target.naturalWidth * 1.12);
              if (frameRef.current) {
                setFrameSize({
                  width: frameRef.current.clientWidth || 0,
                  height: frameRef.current.clientHeight || 0,
                });
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '14px',
              display: 'block',
              margin: 0,
            }}
          />
        </div>
      ) : (
        <img
          className="review-card__image"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={(event) => {
            const target = event.currentTarget;
            setIsTall(target.naturalHeight > target.naturalWidth * 1.12);
            if (frameRef.current) {
              setFrameSize({
                width: frameRef.current.clientWidth || 0,
                height: frameRef.current.clientHeight || 0,
              });
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '14px',
            display: 'block',
            margin: 0,
          }}
        />
      )}
    </div>
  );
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
          className={review.id === highlightedReviewId ? 'review-card review-card--highlighted' : 'review-card'}
        >
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

          {review.imageUrl && <ReviewImageFrame src={review.imageUrl} alt={`${review.placeName} 후기 이미지`} />}

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
                  <HeartIcon filled={review.likedByMe} />
                </span>
                <span className="review-action-button__label">{review.likeCount}</span>
              </button>
              {onOpenComments ? (
                <button
                  type="button"
                  className="review-action-button"
                  onClick={() => onOpenComments(review.id)}
                  aria-label={`댓글 ${review.comments.length}개`}
                >
                  <span className="review-action-button__icon" aria-hidden="true">
                    <CommentIcon />
                  </span>
                  <span className="review-action-button__label">{review.comments.length}</span>
                </button>
              ) : (
                <span className="review-action-button review-action-button--static" aria-hidden="true">
                  <span className="review-action-button__icon">
                    <CommentIcon />
                  </span>
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
