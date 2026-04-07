import { useCallback, useEffect, useRef, useState } from 'react';
import { getReviewComments } from '../api/client';
import type { ApiStatus, Comment } from '../types';

interface UseActiveReviewCommentsParams {
  activeCommentReviewId: string | null;
  setNotice: (message: string | null) => void;
  formatErrorMessage: (error: unknown) => string;
}

export function useActiveReviewComments({
  activeCommentReviewId,
  setNotice,
  formatErrorMessage,
}: UseActiveReviewCommentsParams) {
  const [activeReviewComments, setActiveReviewComments] = useState<Comment[]>([]);
  const [activeReviewCommentsStatus, setActiveReviewCommentsStatus] = useState<ApiStatus>('idle');
  const commentThreadsCacheRef = useRef<Record<string, Comment[]>>({});

  useEffect(() => {
    if (!activeCommentReviewId) {
      setActiveReviewComments([]);
      setActiveReviewCommentsStatus('idle');
      return;
    }

    let cancelled = false;
    const cachedComments = commentThreadsCacheRef.current[activeCommentReviewId];
    if (cachedComments) {
      setActiveReviewComments(cachedComments);
      setActiveReviewCommentsStatus('ready');
    } else {
      setActiveReviewComments([]);
      setActiveReviewCommentsStatus('loading');
    }

    void getReviewComments(activeCommentReviewId)
      .then((comments) => {
        if (cancelled) {
          return;
        }
        commentThreadsCacheRef.current[activeCommentReviewId] = comments;
        setActiveReviewComments(comments);
        setActiveReviewCommentsStatus('ready');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        if (!cachedComments) {
          setActiveReviewCommentsStatus('error');
        }
        setNotice(formatErrorMessage(error));
      });

    return () => {
      cancelled = true;
    };
  }, [activeCommentReviewId, formatErrorMessage, setNotice]);

  const syncReviewComments = useCallback((reviewId: string, comments: Comment[]) => {
    commentThreadsCacheRef.current[reviewId] = comments;
    if (activeCommentReviewId === reviewId) {
      setActiveReviewComments(comments);
      setActiveReviewCommentsStatus('ready');
    }
  }, [activeCommentReviewId]);

  const clearReviewComments = useCallback((reviewId: string) => {
    delete commentThreadsCacheRef.current[reviewId];
    if (activeCommentReviewId === reviewId) {
      setActiveReviewComments([]);
      setActiveReviewCommentsStatus('idle');
    }
  }, [activeCommentReviewId]);

  return {
    activeReviewComments,
    activeReviewCommentsStatus,
    syncReviewComments,
    clearReviewComments,
  };
}
