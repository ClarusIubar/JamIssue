import { useRef } from 'react';
import { categoryInfo } from '../lib/categories';
import { ReviewComposer } from './ReviewComposer';
import type { ApiStatus, DrawerState, Place, Review, ReviewMood, StampLog } from '../types';

interface PlaceDetailSheetProps {
  place: Place | null;
  reviews: Review[];
  isOpen: boolean;
  drawerState: DrawerState;
  loggedIn: boolean;
  visitCount: number;
  latestStamp: StampLog | null;
  todayStamp: StampLog | null;
  stampActionStatus: ApiStatus;
  stampActionMessage: string;
  reviewProofMessage: string;
  reviewError: string | null;
  reviewSubmitting: boolean;
  canCreateReview: boolean;
  onOpenFeedReview: () => void;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onRequestLogin: () => void;
  onClaimStamp: (place: Place) => Promise<void>;
  onCreateReview: (payload: { stampId: string; body: string; mood: ReviewMood; file: File | null }) => Promise<void>;
}

function formatVisitedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function PlaceDetailSheet({
  place,
  reviews,
  isOpen,
  drawerState,
  loggedIn,
  visitCount,
  latestStamp,
  todayStamp,
  stampActionStatus,
  stampActionMessage,
  reviewProofMessage,
  reviewError,
  reviewSubmitting,
  canCreateReview,
  onOpenFeedReview,
  onClose,
  onExpand,
  onCollapse,
  onRequestLogin,
  onClaimStamp,
  onCreateReview,
}: PlaceDetailSheetProps) {
  const dragStartYRef = useRef<number | null>(null);

  if (!place || !isOpen) {
    return null;
  }

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
      if (drawerState === 'full') {
        onCollapse();
        return;
      }
      onClose();
      return;
    }

    if (delta < -48) {
      onExpand();
    }
  }

  const sheetClassName = `place-drawer place-drawer--${drawerState}`;
  const visitLabel = latestStamp ? latestStamp.visitLabel : '첫 방문 대기';
  const canClaimStamp = loggedIn && !todayStamp;
  const categoryMeta = categoryInfo[place.category];
  const reviewPreview = reviews.slice(0, 2);

  return (
    <section className={sheetClassName} aria-label="장소 상세 시트">
      <button
        type="button"
        className="place-drawer__handle"
        aria-label="시트 높이 조절"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={drawerState === 'partial' ? onExpand : onCollapse}
      >
        <span />
      </button>

      <div className="place-drawer__content">
        <div className="place-drawer__header">
          <div>
            <p className="eyebrow">PLACE</p>
            <h2>{place.name}</h2>
            <p className="place-drawer__summary">{place.summary}</p>
          </div>
          <button type="button" className="place-drawer__close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        {place.imageUrl && (
          <div className="place-drawer__hero">
            <img src={place.imageUrl} alt={place.name} className="place-drawer__hero-image" />
          </div>
        )}

        <div className="place-drawer__badges">
          <span className="counter-pill" style={{ background: categoryMeta.color, color: '#4a3140' }}>
            {categoryMeta.icon} {categoryMeta.name}
          </span>
          <span className="counter-pill">{place.district}</span>
          <span className="counter-pill">{visitLabel}</span>
          <span className="counter-pill">누적 방문 {visitCount}회</span>
        </div>

        <div className="sheet-card place-drawer__proof-card">
          <div className="place-drawer__proof-copy">
            <strong>현장 스탬프</strong>
            <p>{stampActionMessage}</p>
          </div>
          <div className="place-drawer__proof-action">
            {!loggedIn ? (
              <>
                <span className="place-drawer__proof-kicker">피드와 코스 시작</span>
                <button type="button" className="primary-button place-drawer__proof-button" onClick={onRequestLogin}>
                  로그인하고 시작
                </button>
              </>
            ) : (
              <button
                type="button"
                className={todayStamp ? 'secondary-button is-complete place-drawer__proof-button' : 'primary-button place-drawer__proof-button'}
                onClick={() => void onClaimStamp(place)}
                disabled={!canClaimStamp || stampActionStatus === 'loading'}
              >
                {todayStamp
                  ? `${todayStamp.visitLabel} 완료`
                  : stampActionStatus === 'loading'
                    ? '확인 중'
                    : '오늘 스탬프 찍기'}
              </button>
            )}
          </div>
        </div>

        <div className="sheet-card route-hint-box">
          <strong>이동 힌트</strong>
          <p>{place.routeHint}</p>
        </div>

        <ReviewComposer
          placeName={place.name}
          loggedIn={loggedIn}
          canSubmit={canCreateReview}
          submitting={reviewSubmitting}
          errorMessage={reviewError}
          proofMessage={reviewProofMessage}
          onSubmit={({ body, mood, file }) => {
            if (!todayStamp) {
              return Promise.resolve();
            }
            return onCreateReview({
              stampId: todayStamp.id,
              body,
              mood,
              file,
            });
          }}
          onRequestLogin={onRequestLogin}
          onRequestProof={() => {
            if (!loggedIn) {
              onRequestLogin();
              return;
            }
            if (!todayStamp) {
              void onClaimStamp(place);
            }
          }}
        />

        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">PLACE FEED</p>
            <h3>이 장소의 피드</h3>
          </div>
          <button type="button" className="secondary-button place-drawer__feed-button" onClick={onOpenFeedReview}>
            피드에서 보기
          </button>
        </div>

        {reviewPreview.length > 0 ? (
          <div className="review-stack place-drawer__feed-preview">
            {reviewPreview.map((review) => (
              <article key={review.id} className="sheet-card place-drawer__preview-card">
                <div className="review-card__top place-drawer__preview-top">
                  <strong>{review.author}</strong>
                  <span className="counter-pill counter-pill--muted">{review.badge}</span>
                </div>
                <p className="review-card__meta-line">
                  {review.visitLabel} · {formatVisitedAt(review.visitedAt)}
                </p>
                <p className="review-card__body place-drawer__preview-body">{review.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="sheet-card stack-gap place-drawer__preview-empty">
            <strong>아직 등록된 피드가 없어요</strong>
            <p className="section-copy">현장 스탬프를 찍은 뒤 첫 피드를 남겨 보세요.</p>
            <button type="button" className="secondary-button primary-button--block" onClick={onOpenFeedReview}>
              피드 탭 열기
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
