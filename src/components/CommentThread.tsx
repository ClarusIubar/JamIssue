import { memo, useEffect, useRef, useState } from 'react';
import type { Comment } from '../types';

interface CommentThreadProps {
  comments: Comment[];
  canWriteComment: boolean;
  currentUserId?: string | null;
  submittingReviewId: string | null;
  mutatingCommentId: string | null;
  highlightedCommentId: string | null;
  reviewId: string;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onUpdateComment: (reviewId: string, commentId: string, body: string) => Promise<void>;
  onDeleteComment: (reviewId: string, commentId: string) => Promise<void>;
  onRequestLogin: () => void;
}

interface CommentComposerProps {
  canWriteComment: boolean;
  placeholder: string;
  reviewId: string;
  submittingReviewId: string | null;
  onRequestLogin: () => void;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  parentId?: string;
  onSubmitted?: () => void;
}

interface CommentItemProps {
  comment: Comment;
  reviewId: string;
  canWriteComment: boolean;
  currentUserId?: string | null;
  submittingReviewId: string | null;
  mutatingCommentId: string | null;
  highlightedCommentId: string | null;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onUpdateComment: (reviewId: string, commentId: string, body: string) => Promise<void>;
  onDeleteComment: (reviewId: string, commentId: string) => Promise<void>;
  onRequestLogin: () => void;
  isReply?: boolean;
}

const CommentComposer = memo(function CommentComposer({
  canWriteComment,
  placeholder,
  reviewId,
  submittingReviewId,
  onRequestLogin,
  onSubmitComment,
  parentId,
  onSubmitted,
}: CommentComposerProps) {
  const [body, setBody] = useState('');
  const isSubmitting = submittingReviewId === reviewId;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteComment) {
      onRequestLogin();
      return;
    }

    const trimmedBody = body.trim();
    if (trimmedBody.length < 2) {
      return;
    }

    await onSubmitComment(reviewId, trimmedBody, parentId);
    setBody('');
    onSubmitted?.();
  }

  return (
    <form className="comment-thread__reply-form" onSubmit={handleSubmit}>
      <input value={body} onChange={(event) => setBody(event.target.value)} placeholder={placeholder} />
      <button type="submit" className="comment-thread__submit" disabled={isSubmitting || body.trim().length < 2}>
        {isSubmitting ? '등록 중' : '등록'}
      </button>
    </form>
  );
});

const CommentItem = memo(function CommentItem({
  comment,
  reviewId,
  canWriteComment,
  currentUserId,
  submittingReviewId,
  mutatingCommentId,
  highlightedCommentId,
  onSubmitComment,
  onUpdateComment,
  onDeleteComment,
  onRequestLogin,
  isReply = false,
}: CommentItemProps) {
  const itemRef = useRef<HTMLLIElement | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingBody, setEditingBody] = useState(comment.body);

  const isMine = currentUserId === comment.userId;
  const isMutating = mutatingCommentId === comment.id;
  const isHighlighted = highlightedCommentId === comment.id;

  useEffect(() => {
    setEditingBody(comment.body);
  }, [comment.body]);

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      itemRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isHighlighted]);

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedBody = editingBody.trim();
    if (trimmedBody.length < 2) {
      return;
    }

    await onUpdateComment(reviewId, comment.id, trimmedBody);
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm('댓글을 삭제할까요?')) {
      return;
    }

    await onDeleteComment(reviewId, comment.id);
  }

  function handleReplyToggle() {
    if (!canWriteComment) {
      onRequestLogin();
      return;
    }

    setReplyOpen((current) => !current);
  }

  return (
    <li ref={itemRef} className={isReply ? 'comment-thread__item comment-thread__item--reply' : 'comment-thread__item'}>
      {isReply && (
        <span className="comment-thread__reply-indent" aria-hidden="true">
          ↳
        </span>
      )}

      <div className="comment-thread__main">
        <div className={isHighlighted ? 'comment-thread__bubble is-highlighted' : 'comment-thread__bubble'}>
          <div className="comment-thread__meta">
            <strong>{comment.author}</strong>
            <span>{comment.createdAt}</span>
          </div>

          {editing && !comment.isDeleted ? (
            <form className="comment-thread__reply-form" onSubmit={handleEditSubmit}>
              <input
                value={editingBody}
                onChange={(event) => setEditingBody(event.target.value)}
                placeholder="댓글 내용을 수정해 보세요"
              />
              <button type="submit" className="comment-thread__submit" disabled={isMutating || editingBody.trim().length < 2}>
                {isMutating ? '수정 중' : '수정'}
              </button>
            </form>
          ) : (
            <p>{comment.isDeleted ? '삭제된 댓글입니다.' : comment.body}</p>
          )}

          {!comment.isDeleted && (
            <div className="comment-thread__actions">
              {canWriteComment && (
                <button type="button" className="comment-thread__reply-toggle" onClick={handleReplyToggle}>
                  답글 달기
                </button>
              )}
              {isMine && !editing && (
                <>
                  <button type="button" className="comment-thread__reply-toggle" onClick={() => setEditing(true)}>
                    수정
                  </button>
                  <button type="button" className="comment-thread__reply-toggle" onClick={() => void handleDelete()} disabled={isMutating}>
                    삭제
                  </button>
                </>
              )}
              {isMine && editing && (
                <button
                  type="button"
                  className="comment-thread__reply-toggle"
                  onClick={() => {
                    setEditing(false);
                    setEditingBody(comment.body);
                  }}
                >
                  취소
                </button>
              )}
            </div>
          )}
        </div>

        {!isReply && replyOpen && (
          <CommentComposer
            canWriteComment={canWriteComment}
            placeholder="답글 내용을 적어 보세요"
            reviewId={reviewId}
            submittingReviewId={submittingReviewId}
            onRequestLogin={onRequestLogin}
            onSubmitComment={onSubmitComment}
            parentId={comment.id}
            onSubmitted={() => setReplyOpen(false)}
          />
        )}

        {!isReply && comment.replies.length > 0 && (
          <ul className="comment-thread__children">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                reviewId={reviewId}
                canWriteComment={canWriteComment}
                currentUserId={currentUserId}
                submittingReviewId={submittingReviewId}
                mutatingCommentId={mutatingCommentId}
                highlightedCommentId={highlightedCommentId}
                onSubmitComment={onSubmitComment}
                onUpdateComment={onUpdateComment}
                onDeleteComment={onDeleteComment}
                onRequestLogin={onRequestLogin}
                isReply={true}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
});

export function CommentThread({
  comments,
  canWriteComment,
  currentUserId = null,
  submittingReviewId,
  mutatingCommentId,
  highlightedCommentId,
  reviewId,
  onSubmitComment,
  onUpdateComment,
  onDeleteComment,
  onRequestLogin,
}: CommentThreadProps) {
  return (
    <div className="comment-thread">
      <CommentComposer
        key={reviewId}
        canWriteComment={canWriteComment}
        placeholder="댓글 내용을 적어 보세요"
        reviewId={reviewId}
        submittingReviewId={submittingReviewId}
        onRequestLogin={onRequestLogin}
        onSubmitComment={onSubmitComment}
      />

      {comments.length > 0 && (
        <ul className="comment-thread__list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              reviewId={reviewId}
              canWriteComment={canWriteComment}
              currentUserId={currentUserId}
              submittingReviewId={submittingReviewId}
              mutatingCommentId={mutatingCommentId}
              highlightedCommentId={highlightedCommentId}
              onSubmitComment={onSubmitComment}
              onUpdateComment={onUpdateComment}
              onDeleteComment={onDeleteComment}
              onRequestLogin={onRequestLogin}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
