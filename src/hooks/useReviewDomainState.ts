import { useReviewFilterState } from './useReviewFilterState';
import { useReviewHighlightState } from './useReviewHighlightState';

export function useReviewDomainState() {
  return {
    ...useReviewFilterState(),
    ...useReviewHighlightState(),
  };
}
