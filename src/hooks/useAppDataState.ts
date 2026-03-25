import { useRef, useState } from 'react';
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

/**
 * 애플리케이션 전반에서 사용하는 도메인 데이터(장소, 행사, 리뷰, 코스 등)를 React 로컬 상태(useState)로
 * 관리하고 공유하기 위한 커스텀 훅입니다. 데이터 캐싱과 부분 갱신을 위한 유틸리티 함수들을 제공합니다.
 * @param selectedPlaceId 현재 지도에서 선택되어 바텀시트가 열려있는 장소의 ID
 */
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

  /**
   * 커뮤니티 루트 목록을 새 데이터로 덮어쓰고, 해당 정렬 기준의 캐시를 갱신합니다.
   */
  function replaceCommunityRoutes(nextRoutes: UserRoute[], sort: CommunityRouteSort = communityRouteSort) {
    communityRoutesCacheRef.current[sort] = nextRoutes;
    setCommunityRoutes(nextRoutes);
  }

  /**
   * 특정 커뮤니티 루트 하나(예: 좋아요 갱신)에 대해서만 상태와 캐시를 부분 수정합니다.
   */
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

  /**
   * 특정 리뷰 하나(예: 좋아요, 댓글 수 갱신)에 대해서 피드 목록, 장소 상세 목록, 캐시 등
   * 관련된 모든 컬렉션에서 상태를 일관되게 동기화(업데이트)합니다.
   */
  function patchReviewCollections(reviewId: string, updater: (review: BootstrapResponse['reviews'][number]) => BootstrapResponse['reviews'][number]) {
    setReviews((current) => current.map((review) => (review.id === reviewId ? updater(review) : review)));
    setSelectedPlaceReviews((current) => current.map((review) => (review.id === reviewId ? updater(review) : review)));
    for (const placeId of Object.keys(placeReviewsCacheRef.current)) {
      placeReviewsCacheRef.current[placeId] = placeReviewsCacheRef.current[placeId].map((review) =>
        review.id === reviewId ? updater(review) : review,
      );
    }
  }

  /**
   * 새로운 리뷰를 목록 맨 앞에 추가하거나, 기존 리뷰의 상태 전체를 덮어씁니다(Upsert).
   */
  function upsertReviewCollections(review: BootstrapResponse['reviews'][number]) {
    setReviews((current) => [review, ...current.filter((currentReview) => currentReview.id !== review.id)]);
    if (selectedPlaceId === review.placeId) {
      setSelectedPlaceReviews((current) => [review, ...current.filter((currentReview) => currentReview.id !== review.id)]);
    }
    const cachedPlaceReviews = placeReviewsCacheRef.current[review.placeId] ?? [];
    placeReviewsCacheRef.current[review.placeId] = [review, ...cachedPlaceReviews.filter((currentReview) => currentReview.id !== review.id)];
  }

  /**
   * 로그인 변경 혹은 앱 초기화 시 캐시된 리뷰 목록을 모두 비웁니다.
   */
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