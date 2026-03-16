import { ReviewComposer } from './ReviewComposer';
import { ReviewList } from './ReviewList';
import type { Place, Review, ReviewMood } from '../types';

interface PlaceDetailSheetProps {
  place: Place | null;
  reviews: Review[];
  isOpen: boolean;
  canWrite: boolean;
  canToggleLike: boolean;
  isStampCollected: boolean;
  isStampBusy: boolean;
  reviewError: string | null;
  reviewSubmitting: boolean;
  reviewLikeUpdatingId: string | null;
  commentSubmittingReviewId: string | null;
  onClose: () => void;
  onRequestLogin: () => void;
  onCollectStamp: (place: Place) => Promise<void>;
  onCreateReview: (payload: { placeId: string; body: string; mood: ReviewMood; file: File | null }) => Promise<void>;
  onToggleReviewLike: (reviewId: string) => Promise<void>;
  onCreateComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
}

export function PlaceDetailSheet({
  place,
  reviews,
  isOpen,
  canWrite,
  canToggleLike,
  isStampCollected,
  isStampBusy,
  reviewError,
  reviewSubmitting,
  reviewLikeUpdatingId,
  commentSubmittingReviewId,
  onClose,
  onRequestLogin,
  onCollectStamp,
  onCreateReview,
  onToggleReviewLike,
  onCreateComment,
}: PlaceDetailSheetProps) {
  if (!place || !isOpen) {
    return null;
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-panel__grab" />
        <div className="sheet-panel__header">
          <div>
            <p className="eyebrow">PLACE COMMUNITY</p>
            <h2>{place.name}</h2>
            <p>{place.summary}</p>
          </div>
          <button type="button" className="text-button" onClick={onClose}>
            ??
          </button>
        </div>
        <div className="detail-meta-card">
          <div>
            <strong>{place.district}</strong>
            <p>{place.visitTime}</p>
          </div>
          <button
            type="button"
            className={isStampCollected ? 'secondary-button is-complete' : 'primary-button'}
            onClick={() => void onCollectStamp(place)}
            disabled={isStampCollected || isStampBusy}
          >
            {isStampBusy ? '?? ?? ?...' : isStampCollected ? '??? ??' : '?? ??? ??'}
          </button>
        </div>
        <div className="route-hint-box">
          <strong>?? ??</strong>
          <p>{place.routeHint}</p>
        </div>
        <ReviewComposer
          key={place.id}
          placeName={place.name}
          loggedIn={canWrite}
          submitting={reviewSubmitting}
          errorMessage={reviewError}
          onSubmit={({ body, mood, file }) => onCreateReview({ placeId: place.id, body, mood, file })}
          onRequestLogin={onRequestLogin}
        />
        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">LIVE FEED</p>
            <h3>? ?? ??? ??</h3>
          </div>
          <span className="counter-pill">{reviews.length}? ??</span>
        </div>
        <ReviewList
          reviews={reviews}
          canWriteComment={canWrite}
          canToggleLike={canToggleLike}
          likingReviewId={reviewLikeUpdatingId}
          submittingReviewId={commentSubmittingReviewId}
          onToggleLike={onToggleReviewLike}
          onSubmitComment={onCreateComment}
          onRequestLogin={onRequestLogin}
        />
      </section>
    </div>
  );
}
