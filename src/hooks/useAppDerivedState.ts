import { useMemo } from 'react';
import { calculateDistanceMeters, getLatestPlaceStamp, getPlaceVisitCount, getTodayStampLog } from '../lib/visits';
import { filterPlacesByCategory } from '../lib/filterPlaces';
import type { Category, FestivalItem, MyPageResponse, Place, Review, SessionUser, StampState, UserRoute } from '../types';

interface UseAppDerivedStateParams {
  places: Place[];
  festivals: FestivalItem[];
  activeCategory: Category;
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  selectedRoutePreview: { placeIds: string[] } | null;
  stampState: StampState;
  currentPosition: { latitude: number; longitude: number } | null;
  sessionUser: SessionUser | null;
  reviews: Review[];
  selectedPlaceReviews: Review[];
  myPageReviews: Review[];
}

/**
 * 앱에 로드된 원본 도메인 데이터를 기반으로 파생되는 부가적인 상태(선택된 장소 객체,
 * 필터링된 장소 목록, 오늘 스탬프 적립 여부, 사용자 리뷰 작성 권한 등)를 계산하고
 * 성능 최적화를 위해 메모이제이션(useMemo)하여 제공하는 훅입니다.
 */
export function useAppDerivedState({
  places,
  festivals,
  activeCategory,
  selectedPlaceId,
  selectedFestivalId,
  selectedRoutePreview,
  stampState,
  currentPosition,
  sessionUser,
  reviews,
  selectedPlaceReviews,
  myPageReviews,
}: UseAppDerivedStateParams) {
  const filteredPlaces = useMemo(() => filterPlacesByCategory(places, activeCategory), [places, activeCategory]);

  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) {
      return null;
    }
    return places.find((place) => place.id === selectedPlaceId) ?? null;
  }, [places, selectedPlaceId]);

  const routePreviewPlaces = useMemo(() => {
    if (!selectedRoutePreview) {
      return [];
    }
    return selectedRoutePreview.placeIds
      .map((placeId) => places.find((place) => place.id === placeId) ?? null)
      .filter(Boolean) as Place[];
  }, [places, selectedRoutePreview]);

  const selectedFestival = useMemo(() => {
    if (!selectedFestivalId) {
      return null;
    }
    return festivals.find((festival) => festival.id === selectedFestivalId) ?? null;
  }, [festivals, selectedFestivalId]);

  const todayStamp = selectedPlace ? getTodayStampLog(stampState.logs, selectedPlace.id) : null;
  const latestStamp = selectedPlace ? getLatestPlaceStamp(stampState.logs, selectedPlace.id) : null;
  const visitCount = selectedPlace ? getPlaceVisitCount(stampState.logs, selectedPlace.id) : 0;
  const selectedPlaceDistanceMeters =
    selectedPlace && currentPosition
      ? calculateDistanceMeters(currentPosition.latitude, currentPosition.longitude, selectedPlace.latitude, selectedPlace.longitude)
      : null;

  const knownMyReviews = useMemo(() => {
    if (!sessionUser) {
      return [];
    }

    const reviewMap = new Map<string, Review>();
    for (const review of [...reviews, ...selectedPlaceReviews, ...myPageReviews]) {
      if (review.userId !== sessionUser.id) {
        continue;
      }
      reviewMap.set(review.id, review);
    }

    return [...reviewMap.values()];
  }, [myPageReviews, reviews, selectedPlaceReviews, sessionUser]);

  const hasCreatedReviewToday = useMemo(() => {
    if (!sessionUser || !todayStamp) {
      return false;
    }

    return knownMyReviews.some((review) => review.stampId === todayStamp.id || review.visitedAt.startsWith(todayStamp.stampedDate));
  }, [knownMyReviews, sessionUser, todayStamp]);

  const canCreateReview = Boolean(sessionUser && selectedPlace && todayStamp && !hasCreatedReviewToday);
  const placeNameById = useMemo(() => Object.fromEntries(places.map((place) => [place.id, place.name])), [places]);

  const reviewProofMessage = !sessionUser
    ? '로그인하면 오늘 방문 인증 뒤에만 피드를 남길 수 있어요.'
    : hasCreatedReviewToday
      ? '오늘은 이미 이 장소 피드를 작성했어요. 피드는 하루에 하나만 남길 수 있어요.'
      : todayStamp
        ? `${todayStamp.visitLabel} 방문 스탬프가 확인됐어요. 오늘 피드 한 개를 작성할 수 있어요.`
        : '오늘 방문 스탬프를 먼저 찍으면 피드를 작성할 수 있어요.';

  return {
    filteredPlaces,
    selectedPlace,
    routePreviewPlaces,
    selectedFestival,
    todayStamp,
    latestStamp,
    visitCount,
    selectedPlaceDistanceMeters,
    hasCreatedReviewToday,
    canCreateReview,
    placeNameById,
    reviewProofMessage,
  };
}
