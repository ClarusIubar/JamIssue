import { useRef } from 'react';
import { CommentThread } from './CommentThread';
import type { Review } from '../types';

interface FeedCommentSheetProps {
  review: Review | null;
  isOpen: boolean;
  canWriteComment: boolean;
  submittingReviewId: string | null;
  highlightedCommentId: string | null;
  onClose: () => void;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onRequestLogin: () => void;
}

export function FeedCommentSheet({
  review,
  isOpen,
  canWriteComment,
  submittingReviewId,
  highlightedCommentId,
  onClose,
  onSubmitComment,
  onRequestLogin,
}: FeedCommentSheetProps) {
  const dragStartYRef = useRef<number | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    dragStartYRef.current = event.clientY;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (dragStartYRef.current === null) {
      return;
    }
    const delta = event.clientY - dragStartYRef.current;
    dragStartYRef.current = null;
    if (delta > 72) {
      onClose();
    }
  }

  const sheetClassName = `feed-comment-sheet${isOpen ? ' feed-comment-sheet--open' : ' feed-comment-sheet--closed'}`;

  return (
    <section className={sheetClassName} aria-label="댓글 시트" aria-hidden={!isOpen}>
      <button
        type="button"
        className="feed-comment-sheet__handle"
        aria-label="시트 닫기"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={onClose}
      >
        <span />
      </button>

      <div className="feed-comment-sheet__content">
        {review && (
          <>
            <div className="feed-comment-sheet__header">
              <div className="feed-comment-sheet__title-group">
                <strong className="feed-comment-sheet__place">{review.placeName}</strong>
                <p className="feed-comment-sheet__meta">
                  {review.author} · {review.visitLabel} · {review.visitedAt}
                </p>
              </div>
              <button type="button" className="feed-comment-sheet__close" onClick={onClose} aria-label="닫기">
                ×
              </button>
            </div>

            <p className="feed-comment-sheet__body">{review.body}</p>

            <div className="feed-comment-sheet__divider" />

            <CommentThread
              comments={review.comments}
              canWriteComment={canWriteComment}
              submittingReviewId={submittingReviewId}
              highlightedCommentId={highlightedCommentId}
              reviewId={review.id}
              onSubmitComment={onSubmitComment}
              onRequestLogin={onRequestLogin}
            />
          </>
        )}
      </div>
    </section>
  );
}
