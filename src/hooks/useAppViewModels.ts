import { useMemo } from 'react';
import {
  calculateDistanceMeters,
  getLatestPlaceStamp,
  getTodayStampLog,
} from '../lib/visits';
import type {
  ApiStatus,
  BootstrapResponse,
  Category,
  FestivalItem,
  MyPageResponse,
  Place,
  Review,
  SessionUser,
  RoutePreview,
} from '../types';

function filterPlacesByCategory(places: Place[], category: Category) {
  if (category === 'all') {
    return places;
  }

  return places.filter((place) => place.category === category);
}

interface UseAppViewModelsParams {
  places: Place[];
  festivals: FestivalItem[];
  reviews: Review[];
  selectedPlaceReviews: Review[];
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  selectedRoutePreview: RoutePreview | null;
  activeCategory: Category;
  myPage: MyPageResponse | null;
  notifications: MyPageResponse['notifications'];
  unreadNotificationCount: number;
  stampState: BootstrapResponse['stamps'];
  currentPosition: { latitude: number; longitude: number } | null;
  sessionUser: SessionUser | null;
  notice: string | null;
  bootstrapStatus: ApiStatus;
  bootstrapError: string | null;
  mapLocationStatus: ApiStatus;
  mapLocationMessage: string | null;
}

export function useAppViewModels({
  places,
  festivals,
  reviews,
  selectedPlaceReviews,
  selectedPlaceId,
  selectedFestivalId,
  selectedRoutePreview,
  activeCategory,
  myPage,
  notifications,
  unreadNotificationCount,
  stampState,
  currentPosition,
  sessionUser,
  notice,
  bootstrapStatus,
  bootstrapError,
  mapLocationStatus,
  mapLocationMessage,
}: UseAppViewModelsParams) {
  const filteredPlaces = useMemo(() => filterPlacesByCategory(places, activeCategory), [places, activeCategory]);
  const hydratedMyPage = useMemo(() => (
    myPage ? {
      ...myPage,
      notifications,
      unreadNotificationCount,
    } : myPage
  ), [myPage, notifications, unreadNotificationCount]);
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
  const visitCount = selectedPlace?.totalVisitCount ?? 0;
  const selectedPlaceDistanceMeters =
    selectedPlace && currentPosition
      ? calculateDistanceMeters(currentPosition.latitude, currentPosition.longitude, selectedPlace.latitude, selectedPlace.longitude)
      : null;
  const knownMyReviews = useMemo(() => {
    if (!sessionUser) {
      return [];
    }

    const reviewMap = new Map();
    for (const review of [...reviews, ...selectedPlaceReviews, ...(myPage?.reviews ?? [])]) {
      if (review.userId !== sessionUser.id) {
        continue;
      }
      reviewMap.set(review.id, review);
    }

    return [...reviewMap.values()] as Review[];
  }, [myPage?.reviews, reviews, selectedPlaceReviews, sessionUser]);
  const hasCreatedReviewToday = useMemo(() => {
    if (!sessionUser || !todayStamp) {
      return false;
    }

    return knownMyReviews.some((review) => review.placeId === todayStamp.placeId && (review.stampId === todayStamp.id || review.visitedAt.startsWith(todayStamp.stampedDate)));
  }, [knownMyReviews, sessionUser, todayStamp]);
  const canCreateReview = Boolean(sessionUser && selectedPlace && todayStamp && !hasCreatedReviewToday);
  const placeNameById = useMemo(() => Object.fromEntries(places.map((place) => [place.id, place.name])), [places]);
  const globalStatus = useMemo(() => {
    if (notice) {
      return { tone: 'info' as const, message: notice };
    }
    if (bootstrapStatus === 'error' && bootstrapError) {
      return { tone: 'error' as const, message: bootstrapError };
    }
    if (mapLocationMessage) {
      return {
        tone: mapLocationStatus === 'error' ? ('error' as const) : ('info' as const),
        message: mapLocationMessage,
      };
    }
    return null;
  }, [notice, bootstrapStatus, bootstrapError, mapLocationMessage, mapLocationStatus]);
  const reviewProofMessage = !sessionUser
    ? '로그인하면 오늘 방문 인증 뒤에만 피드를 남길 수 있어요.'
    : hasCreatedReviewToday
      ? '오늘은 이미 이 장소 피드를 작성했어요. 피드는 하루에 하나만 남길 수 있어요.'
      : todayStamp
        ? `${todayStamp.visitLabel} 방문 스탬프가 확인됐어요. 오늘 피드 한 개를 작성할 수 있어요.`
        : '오늘 방문 스탬프를 먼저 찍으면 피드를 작성할 수 있어요.';

  return {
    filteredPlaces,
    hydratedMyPage,
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
    globalStatus,
    reviewProofMessage,
  };
}
