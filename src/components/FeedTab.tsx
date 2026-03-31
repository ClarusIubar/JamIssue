import { useMemo } from 'react';
import { useAutoLoadMore } from '../hooks/useAutoLoadMore';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { FeedCommentSheet } from './FeedCommentSheet';
import { ReviewList } from './ReviewList';
import type { ApiStatus, Comment, Review, SessionUser } from '../types';

interface FeedTabProps {
  reviews: Review[];
  sessionUser: SessionUser | null;
  reviewLikeUpdatingId: string | null;
  placeFilterId: string | null;
  placeFilterName: string | null;
  commentSubmittingReviewId: string | null;
  commentMutatingId: string | null;
  deletingReviewId: string | null;
  activeCommentReviewId: string | null;
  activeCommentReviewComments: Comment[];
  activeCommentReviewStatus: ApiStatus;
  highlightedCommentId: string | null;
  highlightedReviewId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => Promise<void>;
  onToggleReviewLike: (reviewId: string) => Promise<void>;
  onCreateComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onUpdateComment: (reviewId: string, commentId: string, body: string) => Promise<void>;
  onDeleteComment: (reviewId: string, commentId: string) => Promise<void>;
  onDeleteReview: (reviewId: string) => Promise<void>;
  onRequestLogin: () => void;
  onClearPlaceFilter: () => void;
  onOpenPlace: (placeId: string) => void;
  onOpenComments: (reviewId: string, commentId?: string | null) => void;
  onCloseComments: () => void;
}

export function FeedTab({
  reviews,
  sessionUser,
  reviewLikeUpdatingId,
  placeFilterId,
  placeFilterName,
  commentSubmittingReviewId,
  commentMutatingId,
  deletingReviewId,
  activeCommentReviewId,
  activeCommentReviewComments,
  activeCommentReviewStatus,
  highlightedCommentId,
  highlightedReviewId,
  hasMore,
  loadingMore,
  onLoadMore,
  onToggleReviewLike,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onDeleteReview,
  onRequestLogin,
  onClearPlaceFilter,
  onOpenPlace,
  onOpenComments,
  onCloseComments,
}: FeedTabProps) {
  const skipFeedScrollRestore = Boolean(highlightedReviewId || activeCommentReviewId || highlightedCommentId);
  const scrollRef = useScrollRestoration<HTMLElement>(`feed:${placeFilterId ?? 'all'}`, { skipRestore: skipFeedScrollRestore });
  const loadMoreRef = useAutoLoadMore({
    enabled: hasMore && !placeFilterId,
    loading: loadingMore,
    onLoadMore,
    rootRef: scrollRef,
  });
  const visibleReviews = useMemo(
    () => (placeFilterId ? reviews.filter((review) => review.placeId === placeFilterId) : reviews),
    [placeFilterId, reviews],
  );
  const activeReview = reviews.find((review) => review.id === activeCommentReviewId) ?? null;

  return (
    <>
      <section ref={scrollRef} className="page-panel page-panel--scrollable">
        <header className="panel-header">
          <p className="eyebrow">FEED</p>
          <h2>{placeFilterName ? `${placeFilterName} 피드` : '방문 피드'}</h2>
          <p>
            {placeFilterName ? (
              '지도에서 고른 장소의 방문 피드만 먼저 보여줍니다.'
            ) : (
              <>
                스탬프를 찍은 뒤에만 남길 수 있는
                <br />
                실제 방문 후기만 모아 보여줍니다.
              </>
            )}
          </p>
          {placeFilterName && (
            <div className="chip-row compact-gap">
              <span className="soft-tag">{`현재 장소: ${placeFilterName}`}</span>
              <button type="button" className="chip" onClick={onClearPlaceFilter}>
                전체 피드 보기
              </button>
            </div>
          )}
        </header>
        <ReviewList
          reviews={visibleReviews}
          canWriteComment={Boolean(sessionUser)}
          canToggleLike={Boolean(sessionUser)}
          currentUserId={sessionUser?.id ?? null}
          highlightedReviewId={highlightedReviewId}
          likingReviewId={reviewLikeUpdatingId}
          submittingReviewId={commentSubmittingReviewId}
          onToggleLike={onToggleReviewLike}
          onSubmitComment={onCreateComment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
          onDeleteReview={onDeleteReview}
          onRequestLogin={onRequestLogin}
          onOpenPlace={onOpenPlace}
          onOpenComments={(reviewId) => onOpenComments(reviewId)}
          emptyTitle={placeFilterId ? `${placeFilterName} 피드가 아직 없어요` : '아직 공개된 피드가 없어요'}
          emptyBody={placeFilterId ? '이 장소를 찍은 뒤 첫 피드를 남겨 보세요.' : '먼저 스탬프를 찍고 오늘의 분위기를 짧게 남겨 보세요.'}
        />
        {hasMore && (
          <div className="list-load-more-row">
            <div ref={loadMoreRef} className="list-load-more-sentinel" aria-hidden="true" />
            <button type="button" className="secondary-button" onClick={() => void onLoadMore()} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'More feed'}
            </button>
          </div>
        )}
      </section>
      <FeedCommentSheet
        review={activeReview}
        comments={activeCommentReviewComments}
        commentsStatus={activeCommentReviewStatus}
        isOpen={activeCommentReviewId !== null}
        canWriteComment={Boolean(sessionUser)}
        currentUserId={sessionUser?.id ?? null}
        submittingReviewId={commentSubmittingReviewId}
        mutatingCommentId={commentMutatingId}
        deletingReviewId={deletingReviewId}
        highlightedCommentId={highlightedCommentId}
        onClose={onCloseComments}
        onSubmitComment={onCreateComment}
        onUpdateComment={onUpdateComment}
        onDeleteComment={onDeleteComment}
        onDeleteReview={onDeleteReview}
        onRequestLogin={onRequestLogin}
      />
    </>
  );
}
