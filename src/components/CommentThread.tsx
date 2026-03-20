import { useEffect, useRef, useState } from 'react';
import type { Comment } from '../types';

interface CommentThreadProps {
  comments: Comment[];
  canWriteComment: boolean;
  submittingReviewId: string | null;
  highlightedCommentId: string | null;
  reviewId: string;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onRequestLogin: () => void;
}

interface CommentItemProps {
  comment: Comment;
  reviewId: string;
  canWriteComment: boolean;
  submittingReviewId: string | null;
  highlightedCommentId: string | null;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onRequestLogin: () => void;
  isReply?: boolean;
}

function CommentItem({
  comment,
  reviewId,
  canWriteComment,
  submittingReviewId,
  highlightedCommentId,
  onSubmitComment,
  onRequestLogin,
  isReply = false,
}: CommentItemProps) {
  const [replyBody, setReplyBody] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);
  const itemRef = useRef<HTMLLIElement | null>(null);
  const isHighlighted = highlightedCommentId === comment.id;

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      itemRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isHighlighted]);

  async function handleReplySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteComment) {
      onRequestLogin();
      return;
    }
    if (replyBody.trim().length < 2) {
      return;
    }

    const parentId = isReply && comment.parentId ? comment.parentId : comment.id;
    await onSubmitComment(reviewId, replyBody.trim(), parentId);
    setReplyBody('');
    setReplyOpen(false);
  }

  function handleReplyToggle() {
    if (!canWriteComment) {
      onRequestLogin();
      return;
    }

    setReplyOpen((current) => {
      const next = !current;
      if (next) {
        window.requestAnimationFrame(() => {
          itemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }
      return next;
    });
  }

  return (
    <li ref={itemRef} className={isReply ? 'comment-thread__item comment-thread__item--reply' : 'comment-thread__item'}>
      {isReply && (
        <span className="comment-thread__reply-indent" aria-hidden="true">
          ㄴ
        </span>
      )}

      <div className="comment-thread__main">
        <div className={isHighlighted ? 'comment-thread__bubble is-highlighted' : 'comment-thread__bubble'}>
          <div className="comment-thread__meta">
            <strong>{comment.author}</strong>
            <span>{comment.createdAt}</span>
          </div>
          <p>{comment.isDeleted ? '삭제된 댓글입니다.' : comment.body}</p>
          {!comment.isDeleted && !isReply && (
            <button type="button" className="comment-thread__reply-toggle" onClick={handleReplyToggle}>
              답글 달기
            </button>
          )}
        </div>

        {!isReply && replyOpen && (
          <form className="comment-thread__reply-form" onSubmit={handleReplySubmit}>
            <input value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="답글 내용을 적어 보세요" />
            <button type="submit" className="comment-thread__submit" disabled={submittingReviewId === reviewId || replyBody.trim().length < 2}>
              {submittingReviewId === reviewId ? '보내는 중' : '등록'}
            </button>
          </form>
        )}

        {!isReply && comment.replies.length > 0 && (
          <ul className="comment-thread__children">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                reviewId={reviewId}
                canWriteComment={canWriteComment}
                submittingReviewId={submittingReviewId}
                highlightedCommentId={highlightedCommentId}
                onSubmitComment={onSubmitComment}
                onRequestLogin={onRequestLogin}
                isReply={true}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function CommentThread({
  comments,
  canWriteComment,
  submittingReviewId,
  highlightedCommentId,
  reviewId,
  onSubmitComment,
  onRequestLogin,
}: CommentThreadProps) {
  const [commentBody, setCommentBody] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteComment) {
      onRequestLogin();
      return;
    }
    if (commentBody.trim().length < 2) {
      return;
    }
    await onSubmitComment(reviewId, commentBody.trim());
    setCommentBody('');
  }

  return (
    <div className="comment-thread">
      <form className="comment-thread__form" onSubmit={handleSubmit}>
        <input value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="댓글 내용을 적어 보세요" />
        <button type="submit" className="comment-thread__submit" disabled={submittingReviewId === reviewId || commentBody.trim().length < 2}>
          {submittingReviewId === reviewId ? '올리는 중' : '등록'}
        </button>
      </form>

      {comments.length > 0 && (
        <ul className="comment-thread__list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              reviewId={reviewId}
              canWriteComment={canWriteComment}
              submittingReviewId={submittingReviewId}
              highlightedCommentId={highlightedCommentId}
              onSubmitComment={onSubmitComment}
              onRequestLogin={onRequestLogin}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
