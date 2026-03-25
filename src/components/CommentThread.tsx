import { useEffect, useRef, useState } from 'react';
import type { Comment } from '../types';

/**
 * 전체 댓글 트리(CommentThread) 컴포넌트가 받는 Props 인터페이스입니다.
 * 보여줄 댓글 목록과 권한 여부, 작성/수정 핸들러 등을 포함합니다.
 */
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

/**
 * 개별 댓글 아이템을 렌더링하기 위한 Props 인터페이스입니다.
 * 이 아이템 컴포넌트는 자신이 대댓글인지(isReply) 판단하는 플래그를 가지며,
 * 자기 자신을 재귀적으로 호출해 자식 대댓글 트리를 구성할 수 있습니다.
 */
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

/**
 * 단일 댓글 혹은 대댓글을 화면에 렌더링하는 컴포넌트입니다.
 * 내 댓글인 경우 수정/삭제 폼으로 전환되는 상태를 관리합니다.
 * 자식 댓글(replies)이 있을 경우 재귀적으로 렌더링합니다.
 */
function CommentItem({
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
  const [replyBody, setReplyBody] = useState('');
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

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingBody.trim().length < 2) {
      return;
    }
    await onUpdateComment(reviewId, comment.id, editingBody.trim());
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm('이 댓글을 삭제할까요?')) {
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
          ㄴ
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
              {!isReply && (
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
          <form className="comment-thread__reply-form" onSubmit={handleReplySubmit}>
            <input value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="답글 내용을 적어 보세요" />
            <button type="submit" className="comment-thread__submit" disabled={submittingReviewId === reviewId || replyBody.trim().length < 2}>
              {submittingReviewId === reviewId ? '등록 중' : '등록'}
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
}

/**
 * 피드 카드 하단에 노출되는 전체 댓글 쓰기 및 목록 렌더링 컨테이너입니다.
 * 댓글 작성 폼을 먼저 표시하고, 하단에 `CommentItem`을 이용해 전체 트리를 그립니다.
 */
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
          {submittingReviewId === reviewId ? '등록 중' : '등록'}
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
