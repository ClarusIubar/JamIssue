import { useReviewUIStore } from '../store/review-ui-store';

export function useReviewFilterState() {
  const feedPlaceFilterId = useReviewUIStore((state) => state.feedPlaceFilterId);
  const setFeedPlaceFilterId = useReviewUIStore((state) => state.setFeedPlaceFilterId);

  return {
    feedPlaceFilterId,
    setFeedPlaceFilterId,
  };
}
