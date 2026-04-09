import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getReviews } from '../api/client';
import { toReviewSummaryList } from '../lib/reviews';
import type { Review, Tab } from '../types';

interface UseSelectedPlaceReviewSyncParams {
  activeTab: Tab;
  selectedPlaceId: string | null;
  placeReviewsCacheRef: MutableRefObject<Record<string, Review[]>>;
  setSelectedPlaceReviews: Dispatch<SetStateAction<Review[]>>;
  reportBackgroundError: (error: unknown) => void;
}

export function useSelectedPlaceReviewSync({
  activeTab,
  selectedPlaceId,
  placeReviewsCacheRef,
  setSelectedPlaceReviews,
  reportBackgroundError,
}: UseSelectedPlaceReviewSyncParams) {
  useEffect(() => {
    if (!selectedPlaceId || activeTab !== 'map') {
      setSelectedPlaceReviews([]);
      return;
    }

    const cachedReviews = placeReviewsCacheRef.current[selectedPlaceId];
    if (cachedReviews) {
      setSelectedPlaceReviews(cachedReviews);
      return;
    }

    void getReviews({ placeId: selectedPlaceId })
      .then((nextReviews) => {
        const nextReviewSummaries = toReviewSummaryList(nextReviews);
        placeReviewsCacheRef.current[selectedPlaceId] = nextReviewSummaries;
        setSelectedPlaceReviews(nextReviewSummaries);
      })
      .catch(reportBackgroundError);
  }, [activeTab, placeReviewsCacheRef, reportBackgroundError, selectedPlaceId, setSelectedPlaceReviews]);
}
