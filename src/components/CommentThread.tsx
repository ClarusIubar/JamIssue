import { useState } from 'react';
import type { Comment } from '../types';

interface CommentThreadProps {
  comments: Comment[];
  canWriteComment: boolean;
  submittingReviewId: string | null;
  reviewId: string;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onRequestLogin: () => void;
}

function CommentItem({
  comment,
  reviewId,
  canWriteComment,
  submittingReviewId,
  onSubmitComment,
  onRequestLogin,
}: {
  comment: Comment;
  reviewId: string;
  canWriteComment: boolean;
  submittingReviewId: string | null;
  onSubmitComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onRequestLogin: () => void;
}) {
  const [replyBody, setReplyBody] = useState('');
  const [replyOpen, setReplyOpen] = useState(false);

  async function handleReplySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWriteComment) {
      onRequestLogin();
      return;
    }
    if (replyBody.trim().length < 2) {
      return;
    }
    await onSubmitComment(reviewId, replyBody.trim(), comment.id);
    setReplyBody('');
    setReplyOpen(false);
  }

  return (
    <li className="comment-thread__item">
      <div className="comment-thread__bubble">
        <div className="comment-thread__meta">
          <strong>{comment.author}</strong>
          <span>{comment.createdAt}</span>
        </div>
        <p>{comment.isDeleted ? '삭제된 댓글입니다.' : comment.body}</p>
        {!comment.isDeleted && (
          <button type="button" className="text-button" onClick={() => (canWriteComment ? setReplyOpen((value) => !value) : onRequestLogin())}>
            답글 달기
          </button>
        )}
      </div>

      {replyOpen && (
        <form className="comment-thread__reply-form" onSubmit={handleReplySubmit}>
          <input value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="답글 내용을 적어 보세요" />
          <button type="submit" className="secondary-button" disabled={submittingReviewId === reviewId || replyBody.trim().length < 2}>
            {submittingReviewId === reviewId ? '보내는 중' : '등록'}
          </button>
        </form>
      )}

      {comment.replies.length > 0 && (
        <ul className="comment-thread__children">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              reviewId={reviewId}
              canWriteComment={canWriteComment}
              submittingReviewId={submittingReviewId}
              onSubmitComment={onSubmitComment}
              onRequestLogin={onRequestLogin}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentThread({
  comments,
  canWriteComment,
  submittingReviewId,
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
        <button type="submit" className="secondary-button" disabled={submittingReviewId === reviewId || commentBody.trim().length < 2}>
          {submittingReviewId === reviewId ? '올리는 중' : '댓글'}
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
              onSubmitComment={onSubmitComment}
              onRequestLogin={onRequestLogin}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
