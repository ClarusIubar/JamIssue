import { useRef } from 'react';
import { CommentThread } from './CommentThread';
import type { Review } from '../types';

/**
 * FeedCommentSheet 컴포넌트가 사용하는 프롭스 인터페이스입니다.
 * 리뷰 원문 데이터, 모달의 열림 상태, 댓글 권한 및 작성/수정/삭제 이벤트 핸들러를 포함합니다.
 */
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

/**
 * 피드 탭에서 리뷰 카드를 클릭했을 때 나타나는 하단 댓글 바텀시트 컴포넌트입니다.
 * 선택된 리뷰 본문을 위에 고정시키고, 아래에 해당 리뷰에 달린 댓글 트리(CommentThread)를 보여줍니다.
 * 드래그하여 시트를 닫을 수 있는 핸들 인터랙션을 지원합니다.
 */
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

  /** 포인터 다운 시 시작 Y 좌표를 기록합니다. */
  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    dragStartYRef.current = event.clientY;
  }

  /** 포인터 업 시 Y 좌표의 차이를 계산해 일정 픽셀 이상 드래그했으면 닫기(onClose)를 호출합니다. */
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
