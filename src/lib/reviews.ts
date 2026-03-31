import type { Comment, Review } from '../types';

export function countCommentsInThread(comments: Comment[]): number {
  return comments.reduce((total, comment) => total + 1 + countCommentsInThread(comment.replies), 0);
}

export function toReviewSummary(review: Review): Review {
  return {
    ...review,
    comments: [],
  };
}

export function toReviewSummaryList(reviews: Review[]): Review[] {
  return reviews.map(toReviewSummary);
}
