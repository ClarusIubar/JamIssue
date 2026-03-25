import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getAdminSummary, getCommunityRoutes, getCuratedCourses, getMySummary, getReviewFeedPage } from '../api/client';
import type {
  AdminSummaryResponse,
  CommunityRouteSort,
  Course,
  MyPageResponse,
  Review,
  SessionUser,
  Tab,
  UserRoute,
} from '../types';

type CommunityRoutesCache = Partial<Record<CommunityRouteSort, UserRoute[]>>;

/**
 * useAppTabDataLoaders 훅이 필요로 하는 의존성 및 상태 변경 함수들을 묶어둔 인터페이스입니다.
 */
interface UseAppTabDataLoadersParams {
  activeTab: Tab;
  adminSummary: AdminSummaryResponse | null;
  myPage: MyPageResponse | null;
  sessionUser: SessionUser | null;
  communityRoutesCacheRef: MutableRefObject<CommunityRoutesCache>;
  feedLoadedRef: MutableRefObject<boolean>;
  coursesLoadedRef: MutableRefObject<boolean>;
  replaceCommunityRoutes: (nextRoutes: UserRoute[], sort?: CommunityRouteSort) => void;
  setCommunityRoutes: Dispatch<SetStateAction<UserRoute[]>>;
  setReviews: Dispatch<SetStateAction<Review[]>>;
  setFeedHasMore: Dispatch<SetStateAction<boolean>>;
  setFeedNextCursor: Dispatch<SetStateAction<string | null>>;
  setCourses: Dispatch<SetStateAction<Course[]>>;
  setAdminLoading: Dispatch<SetStateAction<boolean>>;
  setAdminSummary: Dispatch<SetStateAction<AdminSummaryResponse | null>>;
  setMyPage: Dispatch<SetStateAction<MyPageResponse | null>>;
  setMyPageError: Dispatch<SetStateAction<string | null>>;
}

/**
 * 앱의 주요 탭(커뮤니티 경로, 피드, 큐레이션 코스, 관리자 요약, 마이페이지) 진입 시
 * 데이터를 지연 로딩(Lazy Loading)하거나 캐시된 데이터를 반환하는 함수들을 제공하는 커스텀 훅입니다.
 */
export function useAppTabDataLoaders({
  activeTab,
  adminSummary,
  myPage,
  sessionUser,
  communityRoutesCacheRef,
  feedLoadedRef,
  coursesLoadedRef,
  replaceCommunityRoutes,
  setCommunityRoutes,
  setReviews,
  setFeedHasMore,
  setFeedNextCursor,
  setCourses,
  setAdminLoading,
  setAdminSummary,
  setMyPage,
  setMyPageError,
}: UseAppTabDataLoadersParams) {
  /**
   * 커뮤니티(사용자) 코스 목록을 가져옵니다. 캐시된 내역이 있으면 이를 반환하고,
   * force 플래그가 참이면 서버에서 최신 목록을 강제로 불러옵니다.
   */
  async function fetchCommunityRoutes(sort: CommunityRouteSort, force = false) {
    const cached = communityRoutesCacheRef.current[sort];
    if (!force && cached) {
      setCommunityRoutes(cached);
      return cached;
    }

    const nextRoutes = await getCommunityRoutes(sort);
    replaceCommunityRoutes(nextRoutes, sort);
    return nextRoutes;
  }

  /**
   * 피드 탭의 리뷰 목록 초기 로딩을 보장합니다. 한 번 로드된 후에는
   * force 플래그가 참일 때만 다시 로드합니다.
   */
  async function ensureFeedReviews(force = false) {
    if (!force && feedLoadedRef.current) {
      return;
    }

    const page = await getReviewFeedPage({ limit: 10 });
    setReviews(page.items);
    setFeedNextCursor(page.nextCursor);
    setFeedHasMore(Boolean(page.nextCursor));
    feedLoadedRef.current = true;
  }

  /**
   * 코스 탭의 공식 큐레이션 코스 목록의 초기 로딩을 보장합니다.
   */
  async function ensureCuratedCourses(force = false) {
    if (!force && coursesLoadedRef.current) {
      return;
    }

    const response = await getCuratedCourses();
    setCourses(response.courses);
    coursesLoadedRef.current = true;
  }

  /**
   * 관리자 탭 진입 시 대시보드 통계 및 장소 요약 정보를 서버에서 조회합니다.
   */
  async function refreshAdminSummary(force = false) {
    if (!sessionUser?.isAdmin) {
      setAdminSummary(null);
      return null;
    }

    if (!force && activeTab !== 'my' && adminSummary !== null) {
      return adminSummary;
    }

    setAdminLoading(true);
    try {
      const nextSummary = await getAdminSummary();
      setAdminSummary(nextSummary);
      return nextSummary;
    } finally {
      setAdminLoading(false);
    }
  }

  /**
   * 로그인한 사용자의 마이페이지 요약(통계, 내 댓글, 스탬프 등) 데이터를 불러옵니다.
   */
  async function refreshMyPageForUser(user: SessionUser | null, force = false) {
    if (!user) {
      setMyPage(null);
      setMyPageError(null);
      return null;
    }

    if (!force && activeTab !== 'my' && myPage === null) {
      return null;
    }

    try {
      const nextMyPage = await getMySummary();
      setMyPage(nextMyPage);
      setMyPageError(null);
      return nextMyPage;
    } catch (error) {
      setMyPage(null);
      setMyPageError(error instanceof Error ? error.message : '마이페이지 정보를 불러오지 못했어요.');
      if (activeTab !== 'my') {
        return null;
      }
      throw error;
    }
  }

  return {
    fetchCommunityRoutes,
    ensureFeedReviews,
    ensureCuratedCourses,
    refreshAdminSummary,
    refreshMyPageForUser,
  };
}
