import { ReviewList } from './ReviewList';
import type { Review, ReviewMood, SessionUser } from '../types';

interface FeedTabProps {
  reviews: Review[];
  sessionUser: SessionUser | null;
  reviewLikeUpdatingId: string | null;
  commentSubmittingReviewId: string | null;
  editingReviewId: string | null;
  reviewEditSubmitting: boolean;
  reviewEditError: string | null;
  onToggleReviewLike: (reviewId: string) => Promise<void>;
  onCreateComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onRequestLogin: () => void;
  onOpenPlace: (placeId: string) => void;
  onEditReview: (reviewId: string) => void;
  onSaveEdit: (reviewId: string, payload: { body: string; mood: ReviewMood; file: File | null }) => Promise<void>;
  onCancelEdit: () => void;
}

export function FeedTab({
  reviews,
  sessionUser,
  reviewLikeUpdatingId,
  commentSubmittingReviewId,
  editingReviewId,
  reviewEditSubmitting,
  reviewEditError,
  onToggleReviewLike,
  onCreateComment,
  onRequestLogin,
  onOpenPlace,
  onEditReview,
  onSaveEdit,
  onCancelEdit,
}: FeedTabProps) {
  return (
    <section className="page-panel page-panel--scrollable">
      <header className="panel-header">
        <p className="eyebrow">FEED</p>
        <h2>방문 피드</h2>
        <p>스탬프를 찍은 뒤에만 남길 수 있는 실제 방문 후기만 모아 보여줍니다.</p>
      </header>
      <ReviewList
        reviews={reviews}
        sessionUserId={sessionUser?.id ?? null}
        canWriteComment={Boolean(sessionUser)}
        canToggleLike={Boolean(sessionUser)}
        likingReviewId={reviewLikeUpdatingId}
        submittingReviewId={commentSubmittingReviewId}
        editingReviewId={editingReviewId}
        reviewEditSubmitting={reviewEditSubmitting}
        reviewEditError={reviewEditError}
        onToggleLike={onToggleReviewLike}
        onSubmitComment={onCreateComment}
        onRequestLogin={onRequestLogin}
        onOpenPlace={onOpenPlace}
        onEditReview={onEditReview}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        emptyTitle="아직 공개된 피드가 없어요"
        emptyBody="먼저 스탬프를 찍고 오늘의 분위기를 짧게 남겨 보세요."
      />
    </section>
  );
}
