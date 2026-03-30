import { describe, expect, it } from 'vitest';
import type { Review, StampLog } from '../../src/types';
import { placeFixture, sessionUserFixture, todayStampFixture } from '../fixtures/app-fixtures';

/**
 * Reproduces the logic of `hasCreatedReviewToday` from useAppDerivedState / useAppViewModels
 * so it can be tested in isolation.
 */
function hasCreatedReviewToday(
  knownMyReviews: Review[],
  todayStamp: StampLog,
): boolean {
  return knownMyReviews.some(
    (review) =>
      review.placeId === todayStamp.placeId &&
      (review.stampId === todayStamp.id || review.visitedAt.startsWith(todayStamp.stampedDate)),
  );
}

const TODAY = '2026-03-28';

const todayStamp: StampLog = {
  ...todayStampFixture,
  placeId: placeFixture.id,
  stampedDate: TODAY,
  isToday: true,
};

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'review-1',
    userId: sessionUserFixture.id,
    placeId: placeFixture.id,
    placeName: placeFixture.name,
    author: sessionUserFixture.nickname,
    body: '좋아요',
    mood: '혼자서',
    badge: '로컬 탐방',
    visitedAt: `${TODAY}T12:00:00`,
    imageUrl: null,
    commentCount: 0,
    likeCount: 0,
    likedByMe: false,
    stampId: todayStamp.id,
    visitNumber: 1,
    visitLabel: '1번째 방문',
    travelSessionId: null,
    hasPublishedRoute: false,
    comments: [],
    ...overrides,
  };
}

describe('hasCreatedReviewToday', () => {
  it('returns true when the user already wrote a review for the same place today (by stamp id)', () => {
    const review = makeReview({ stampId: todayStamp.id });
    expect(hasCreatedReviewToday([review], todayStamp)).toBe(true);
  });

  it('returns true when the user already wrote a review for the same place today (by visitedAt date)', () => {
    const review = makeReview({ stampId: 'other-stamp', visitedAt: `${TODAY}T15:00:00` });
    expect(hasCreatedReviewToday([review], todayStamp)).toBe(true);
  });

  it('returns false when the only review today is for a DIFFERENT place (bug regression)', () => {
    const otherPlaceReview = makeReview({
      placeId: 'other-place',
      stampId: 'other-stamp-id',
      visitedAt: `${TODAY}T10:00:00`,
    });
    expect(hasCreatedReviewToday([otherPlaceReview], todayStamp)).toBe(false);
  });

  it('returns false when there are no reviews', () => {
    expect(hasCreatedReviewToday([], todayStamp)).toBe(false);
  });

  it('returns false when the only review for this place is on a different day', () => {
    const yesterdayReview = makeReview({ visitedAt: '2026-03-27T12:00:00', stampId: 'old-stamp' });
    expect(hasCreatedReviewToday([yesterdayReview], todayStamp)).toBe(false);
  });
});
