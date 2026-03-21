import { useRef } from 'react';
import { CommentThread } from './CommentThread';
import type { Review } from '../types';

interface FeedCommentSheetProps {
  review: Review | null;
  isOpen: boolean;
  canWriteComment: boolean;
  currentUserId?: string | null;
  submittingReviewId: string | null;
  mutatingCommentId: string | null;
  deletingReviewId: string | null;
  highlightedCommentId: string | null;
  onClose: () => void;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onUpdateComment: (reviewId: string, commentId: string, body: string) => Promise<void>;
  onDeleteComment: (reviewId: string, commentId: string) => Promise<void>;
  onDeleteReview: (reviewId: string) => Promise<void>;
  onRequestLogin: () => void;
}

export function FeedCommentSheet({
  review,
  isOpen,
  canWriteComment,
  currentUserId = null,
  submittingReviewId,
  mutatingCommentId,
  deletingReviewId,
  highlightedCommentId,
  onClose,
  onSubmitComment,
  onUpdateComment,
  onDeleteComment,
  onDeleteReview,
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
  const isMine = review ? review.userId === currentUserId : false;

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
              <div className="feed-comment-sheet__header-actions">
                {isMine && (
                  <button
                    type="button"
                    className="secondary-button feed-comment-sheet__delete"
                    onClick={() => void onDeleteReview(review.id)}
                    disabled={deletingReviewId === review.id}
                  >
                    {deletingReviewId === review.id ? '삭제 중' : '피드 삭제'}
                  </button>
                )}
                <button type="button" className="feed-comment-sheet__close" onClick={onClose} aria-label="닫기">
                  ×
                </button>
              </div>
            </div>

            <p className="feed-comment-sheet__body">{review.body}</p>

            <div className="feed-comment-sheet__divider" />

            <CommentThread
              comments={review.comments}
              canWriteComment={canWriteComment}
              currentUserId={currentUserId}
              submittingReviewId={submittingReviewId}
              mutatingCommentId={mutatingCommentId}
              highlightedCommentId={highlightedCommentId}
              reviewId={review.id}
              onSubmitComment={onSubmitComment}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              onRequestLogin={onRequestLogin}
            />
          </>
        )}
      </div>
    </section>
  );
}
