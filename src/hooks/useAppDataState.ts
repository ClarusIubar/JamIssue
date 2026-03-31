import { useRef, useState } from 'react';
import { toReviewSummary } from '../lib/reviews';
import type {
  AdminSummaryResponse,
  AuthProvider,
  BootstrapResponse,
  CommunityRouteSort,
  FestivalItem,
  MyPageResponse,
  RoutePreview,
  SessionUser,
  UserRoute,
} from '../types';

const emptyProviders: AuthProvider[] = [
  { key: 'naver', label: '\uB124\uC774\uBC84', isEnabled: false, loginUrl: null },
  { key: 'kakao', label: '\uCE74\uCE74\uC624', isEnabled: false, loginUrl: null },
];

export function useAppDataState(selectedPlaceId: string | null) {
  const [bootstrapStatus, setBootstrapStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [places, setPlaces] = useState<BootstrapResponse['places']>([]);
  const [festivals, setFestivals] = useState<FestivalItem[]>([]);
  const [reviews, setReviews] = useState<BootstrapResponse['reviews']>([]);
  const [selectedPlaceReviews, setSelectedPlaceReviews] = useState<BootstrapResponse['reviews']>([]);
  const [courses, setCourses] = useState<BootstrapResponse['courses']>([]);
  const [stampState, setStampState] = useState<BootstrapResponse['stamps']>({
    collectedPlaceIds: [],
    logs: [],
    travelSessions: [],
  });
  const [hasRealData, setHasRealData] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [providers, setProviders] = useState<AuthProvider[]>(emptyProviders);
  const [communityRoutes, setCommunityRoutes] = useState<UserRoute[]>([]);
  const [communityRouteSort, setCommunityRouteSort] = useState<CommunityRouteSort>('popular');
  const [myPage, setMyPage] = useState<MyPageResponse | null>(null);
  const [adminSummary, setAdminSummary] = useState<AdminSummaryResponse | null>(null);
  const [adminBusyPlaceId, setAdminBusyPlaceId] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [selectedRoutePreview, setSelectedRoutePreview] = useState<RoutePreview | null>(null);

  const communityRoutesCacheRef = useRef<Partial<Record<CommunityRouteSort, UserRoute[]>>>({});
  const placeReviewsCacheRef = useRef<Record<string, BootstrapResponse['reviews']>>({});
  const feedLoadedRef = useRef(false);
  const coursesLoadedRef = useRef(false);

  function replaceCommunityRoutes(nextRoutes: UserRoute[], sort: CommunityRouteSort = communityRouteSort) {
    communityRoutesCacheRef.current[sort] = nextRoutes;
    setCommunityRoutes(nextRoutes);
  }

  function patchCommunityRoutes(routeId: string, updater: (route: UserRoute) => UserRoute) {
    const nextCache: Partial<Record<CommunityRouteSort, UserRoute[]>> = {};
    for (const sortKey of Object.keys(communityRoutesCacheRef.current) as CommunityRouteSort[]) {
      const routes = communityRoutesCacheRef.current[sortKey];
      if (!routes) {
        continue;
      }
      nextCache[sortKey] = routes.map((route) => (route.id === routeId ? updater(route) : route));
    }
    communityRoutesCacheRef.current = nextCache;
    setCommunityRoutes((current) => current.map((route) => (route.id === routeId ? updater(route) : route)));
  }

  function patchReviewCollections(reviewId: string, updater: (review: BootstrapResponse['reviews'][number]) => BootstrapResponse['reviews'][number]) {
    setReviews((current) => current.map((review) => (review.id === reviewId ? toReviewSummary(updater(review)) : review)));
    setSelectedPlaceReviews((current) => current.map((review) => (review.id === reviewId ? toReviewSummary(updater(review)) : review)));
    for (const placeId of Object.keys(placeReviewsCacheRef.current)) {
      placeReviewsCacheRef.current[placeId] = placeReviewsCacheRef.current[placeId].map((review) =>
        review.id === reviewId ? toReviewSummary(updater(review)) : review,
      );
    }
  }

  function upsertReviewCollections(review: BootstrapResponse['reviews'][number]) {
    const nextReview = toReviewSummary(review);
    setReviews((current) => [nextReview, ...current.filter((currentReview) => currentReview.id !== review.id)]);
    if (selectedPlaceId === review.placeId) {
      setSelectedPlaceReviews((current) => [nextReview, ...current.filter((currentReview) => currentReview.id !== review.id)]);
    }
    const cachedPlaceReviews = placeReviewsCacheRef.current[review.placeId] ?? [];
    placeReviewsCacheRef.current[review.placeId] = [nextReview, ...cachedPlaceReviews.filter((currentReview) => currentReview.id !== review.id)];
  }

  function resetReviewCaches() {
    placeReviewsCacheRef.current = {};
    feedLoadedRef.current = false;
    coursesLoadedRef.current = false;
    setSelectedPlaceReviews([]);
  }

  return {
    bootstrapStatus,
    setBootstrapStatus,
    bootstrapError,
    setBootstrapError,
    places,
    setPlaces,
    festivals,
    setFestivals,
    reviews,
    setReviews,
    selectedPlaceReviews,
    setSelectedPlaceReviews,
    courses,
    setCourses,
    stampState,
    setStampState,
    hasRealData,
    setHasRealData,
    sessionUser,
    setSessionUser,
    providers,
    setProviders,
    communityRoutes,
    setCommunityRoutes,
    communityRouteSort,
    setCommunityRouteSort,
    myPage,
    setMyPage,
    adminSummary,
    setAdminSummary,
    adminBusyPlaceId,
    setAdminBusyPlaceId,
    adminLoading,
    setAdminLoading,
    selectedRoutePreview,
    setSelectedRoutePreview,
    communityRoutesCacheRef,
    placeReviewsCacheRef,
    feedLoadedRef,
    coursesLoadedRef,
    replaceCommunityRoutes,
    patchCommunityRoutes,
    patchReviewCollections,
    upsertReviewCollections,
    resetReviewCaches,
  };
}
