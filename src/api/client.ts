import { getClientConfig } from '../config';
import { prepareReviewImageUpload } from '../lib/imageUpload';
import type {
  AdminPlace,
  AdminSummaryResponse,
  AuthSessionResponse,
  BootstrapResponse,
  CourseBootstrapResponse,
  DiscoveryRecommendationsResponse,
  DiscoverySearchResponse,
  MapBootstrapResponse,
  Comment,
  CommentCreateRequest,
  CommunityRouteSort,
  MyCommentPageResponse,
  MyPageResponse,
  PlaceVisibilityRequest,
  ProfileUpdateRequest,
  ProviderKey,
  PublicImportResponse,
  Review,
  ReviewCreateRequest,
  ReviewFeedPageResponse,
  ReviewLikeResponse,
  StampClaimRequest,
  StampState,
  UploadResponse,
  UserRoute,
  UserRouteCreateRequest,
  UserRouteLikeResponse,
} from '../types';
import type { PublicEventBannerResponse } from '../publicEventTypes';
import type { FestivalItem } from '../types';

/**
 * API 요청 중 서버 응답이 실패(ok 아님) 상태일 때 발생하는 커스텀 에러 클래스입니다.
 */
class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_GET_TTL_MS = 15_000;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();
const pendingCache = new Map<string, Promise<unknown>>();

/**
 * 주어진 RequestInit 객체가 GET 요청인지 판단합니다. 캐싱 가능 여부 검사에 사용됩니다.
 */
function isGetRequest(init?: RequestInit) {
  return (init?.method ?? 'GET').toUpperCase() === 'GET' && !init?.body;
}

/**
 * 객체를 깊은 복사하여 반환합니다. 캐시된 객체의 불변성을 유지하기 위해 사용합니다.
 */
function clonePayload<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * 요청 경로와 메서드를 조합하여 캐시 키를 생성합니다.
 */
function buildCacheKey(path: string, init?: RequestInit) {
  const method = (init?.method ?? 'GET').toUpperCase();
  return method + ':' + path;
}

/**
 * 경로(엔드포인트)별로 적절한 캐시 만료 시간(TTL, 밀리초 단위)을 반환합니다.
 */
function getTtlForPath(path: string) {
  if (path.startsWith('/api/festivals') || path.startsWith('/api/banner/events')) {
    return 30 * 60 * 1000;
  }
  if (path.startsWith('/api/courses/curated')) {
    return 60 * 1000;
  }
  if (path.startsWith('/api/map-bootstrap') || path.startsWith('/api/community-routes')) {
    return 20 * 1000;
  }
  if (path.startsWith('/api/reviews') || path.startsWith('/api/my/summary')) {
    return 10 * 1000;
  }
  return DEFAULT_GET_TTL_MS;
}

/**
 * 주어진 접두사(prefixes)를 포함하는 API 응답 캐시 및 진행 중인 요청 캐시를 무효화합니다.
 * 접두사가 없으면 모든 캐시를 비웁니다.
 */
export function invalidateApiCache(prefixes: string[] = []) {
  if (prefixes.length === 0) {
    responseCache.clear();
    pendingCache.clear();
    return;
  }

  for (const key of [...responseCache.keys()]) {
    if (prefixes.some((prefix) => key.includes(prefix))) {
      responseCache.delete(key);
    }
  }

  for (const key of [...pendingCache.keys()]) {
    if (prefixes.some((prefix) => key.includes(prefix))) {
      pendingCache.delete(key);
    }
  }
}

const WORKER_FALLBACK_BASE_URL = 'https://jamissue-api.yhh4433.workers.dev';

/**
 * HTTP Response 객체의 응답 상태를 검사하고, 성공 시 JSON 데이터를, 실패 시 ApiError를 던집니다.
 * 401 에러 시 커스텀 이벤트(jamissue:auth-expired)를 발생시킵니다.
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = '요청을 처리하지 못했어요.';
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      message = response.statusText || message;
    }
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jamissue:auth-expired', { detail: { path: response.url } }));
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * 설정된 apiBaseUrl을 기반으로 HTTP 요청을 수행하고 JSON 결과를 반환하는 래퍼 함수입니다.
 * 중복된 GET 요청의 결과 캐싱 및 워커 풀백(Worker Fallback) 로직을 포함합니다.
 */
async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiBaseUrl } = getClientConfig();
  const headers = new Headers(init?.headers || undefined);
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const canCache = isGetRequest(init);
  const cacheKey = buildCacheKey(path, init);
  const now = Date.now();

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (canCache) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return clonePayload(cached.value as T);
    }
    const pending = pendingCache.get(cacheKey);
    if (pending) {
      return clonePayload((await pending) as T);
    }
  }

  const fetchFromBase = async (baseUrl: string) => {
    const response = await fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
      headers,
    });
    return parseJsonResponse<T>(response);
  };

  const requestPromise = (async () => {
    try {
      return await fetchFromBase(apiBaseUrl);
    } catch (error) {
      const shouldFallback = apiBaseUrl !== WORKER_FALLBACK_BASE_URL && !(error instanceof ApiError);
      if (!shouldFallback) {
        throw error;
      }
      return fetchFromBase(WORKER_FALLBACK_BASE_URL);
    }
  })();

  if (canCache) {
    pendingCache.set(cacheKey, requestPromise as Promise<unknown>);
  }

  try {
    const payload = await requestPromise;
    if (canCache) {
      responseCache.set(cacheKey, {
        expiresAt: now + getTtlForPath(path),
        value: clonePayload(payload),
      });
    }
    return payload;
  } finally {
    if (canCache) {
      pendingCache.delete(cacheKey);
    }
  }
}

/**
 * 현재 클라이언트 환경에 설정된 백엔드 API Base URL을 반환합니다.
 */
export function getApiBaseUrl() {
  return getClientConfig().apiBaseUrl;
}

/**
 * 특정 소셜 로그인(provider) 페이지로 이동하기 위한 인증 URL을 생성합니다.
 */
export function getProviderLoginUrl(provider: ProviderKey, nextUrl: string, mode: 'login' | 'link' = 'login') {
  return `${getApiBaseUrl()}/api/auth/${provider}/login?next=${encodeURIComponent(nextUrl)}&mode=${mode}`;
}

/**
 * 현재 사용자의 세션 및 로그인 정보, 통계 데이터를 조회합니다.
 */
export function getAuthSession() {
  return fetchJson<AuthSessionResponse>('/api/auth/me');
}

/**
 * 사용자의 로그아웃을 요청하고 관련 API 캐시를 모두 초기화합니다.
 */
export async function logout() {
  const response = await fetchJson<AuthSessionResponse>('/api/auth/logout', {
    method: 'POST',
  });
  invalidateApiCache(['/api/auth/me', '/api/map-bootstrap', '/api/my/summary', '/api/community-routes', '/api/reviews']);
  return response;
}

/**
 * 내 프로필(닉네임 등)을 업데이트하고 연관 캐시를 무효화합니다.
 */
export async function updateProfile(payload: ProfileUpdateRequest) {
  const response = await fetchJson<AuthSessionResponse>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/auth/me', '/api/my/summary', '/api/community-routes', '/api/reviews']);
  return response;
}

/**
 * 앱 최초 진입 시 필요한 모든 초기 부트스트랩 데이터를 조회합니다.
 */
export function getBootstrap() {
  return fetchJson<BootstrapResponse>('/api/bootstrap');
}

/**
 * 지도 화면 진입 시 최소한의 초기 데이터를 조회합니다. 서버 에러 시 전체 부트스트랩 결과로 풀백합니다.
 */
export async function getMapBootstrap() {
  try {
    return await fetchJson<MapBootstrapResponse>('/api/map-bootstrap');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 501 || error.status >= 500)) {
      const bootstrap = await getBootstrap();
      return {
        auth: bootstrap.auth,
        places: bootstrap.places,
        stamps: bootstrap.stamps,
        hasRealData: bootstrap.hasRealData,
      };
    }
    throw error;
  }
}

/**
 * 운영자가 선정한 큐레이션 코스 목록을 조회합니다. 에러 시 전체 부트스트랩 데이터의 코스 정보로 대체합니다.
 */
export async function getCuratedCourses() {
  try {
    return await fetchJson<CourseBootstrapResponse>('/api/courses/curated');
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 501 || error.status >= 500)) {
      const bootstrap = await getBootstrap();
      return { courses: bootstrap.courses };
    }
    throw error;
  }
}

/**
 * 공개된 커뮤니티(사용자 생성) 코스(루트) 목록을 조회합니다.
 */
export function getCommunityRoutes(sort: CommunityRouteSort = 'popular') {
  return fetchJson<UserRoute[]>(`/api/community-routes?sort=${sort}`);
}

/**
 * 특정 여행 세션을 기반으로 새 커뮤니티 코스(루트)를 발행합니다.
 */
export async function createUserRoute(payload: UserRouteCreateRequest) {
  const response = await fetchJson<UserRoute>('/api/community-routes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/community-routes', '/api/my/routes', '/api/my/summary']);
  return response;
}

/**
 * 특정 커뮤니티 루트에 대한 좋아요 상태를 변경(토글)합니다.
 */
export async function toggleCommunityRouteLike(routeId: string) {
  const response = await fetchJson<UserRouteLikeResponse>(`/api/community-routes/${routeId}/like`, {
    method: 'POST',
  });
  invalidateApiCache(['/api/community-routes', '/api/my/routes']);
  return response;
}

/**
 * 내가 생성한 모든 커뮤니티 루트 목록을 조회합니다.
 */
export function getMyRoutes() {
  return fetchJson<UserRoute[]>('/api/my/routes');
}

/**
 * 장소 단위, 혹은 특정 사용자 단위로 피드(리뷰) 목록 전체를 조회합니다.
 */
export function getReviews(params?: { placeId?: string; userId?: string }) {
  const search = new URLSearchParams();
  if (params?.placeId) {
    search.set('placeId', params.placeId);
  }
  if (params?.userId) {
    search.set('userId', params.userId);
  }
  const query = search.toString();
  return fetchJson<Review[]>(`/api/reviews${query ? `?${query}` : ''}`);
}

/**
 * 피드 탭에서 사용할 무한 스크롤 형태의 피드 목록을 페이지 단위로 조회합니다.
 */
export function getReviewFeedPage(params?: { cursor?: string | null; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params?.limit) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return fetchJson<ReviewFeedPageResponse>(`/api/review-feed${query ? `?${query}` : ''}`);
}

/**
 * 단일 피드(리뷰)의 상세 정보를 조회합니다.
 */
export function getReviewDetail(reviewId: string) {
  return fetchJson<Review>(`/api/reviews/${reviewId}`);
}

/**
 * 새로운 피드(리뷰)를 작성합니다. 작성 성공 시 연관된 캐시를 무효화합니다.
 */
export async function createReview(payload: ReviewCreateRequest) {
  const response = await fetchJson<Review>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/reviews', '/api/my/summary']);
  return response;
}

/**
 * 피드(리뷰)의 좋아요 상태를 토글합니다.
 */
export async function toggleReviewLike(reviewId: string) {
  const response = await fetchJson<ReviewLikeResponse>(`/api/reviews/${reviewId}/like`, {
    method: 'POST',
  });
  invalidateApiCache(['/api/reviews']);
  return response;
}

/**
 * 특정 리뷰에 달린 전체 댓글 트리를 조회합니다.
 */
export function getReviewComments(reviewId: string) {
  return fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments`);
}

/**
 * 특정 리뷰에 새 댓글(또는 대댓글)을 작성합니다.
 */
export async function createComment(reviewId: string, payload: CommentCreateRequest) {
  const response = await fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateApiCache([`/api/reviews/${reviewId}/comments`, '/api/reviews', '/api/my/summary']);
  return response;
}

/**
 * 특정 댓글의 본문 내용을 수정합니다.
 */
export async function updateComment(reviewId: string, commentId: string, payload: { body: string }) {
  const response = await fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  invalidateApiCache([`/api/reviews/${reviewId}/comments`, '/api/reviews', '/api/my/summary']);
  return response;
}

/**
 * 특정 댓글을 삭제(소프트 삭제)합니다.
 */
export async function deleteComment(reviewId: string, commentId: string) {
  const response = await fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments/${commentId}`, {
    method: 'DELETE',
  });
  invalidateApiCache([`/api/reviews/${reviewId}/comments`, '/api/reviews', '/api/my/summary']);
  return response;
}

/**
 * 특정 리뷰(피드)를 영구적으로 삭제합니다.
 */
export async function deleteReview(reviewId: string) {
  const response = await fetchJson<{ reviewId: string; deleted: boolean }>(`/api/reviews/${reviewId}`, {
    method: 'DELETE',
  });
  invalidateApiCache(['/api/reviews', '/api/my/summary']);
  return response;
}

/**
 * 사용자 디바이스의 원본 이미지 파일을 클라이언트에서 리사이즈/압축 후 서버로 업로드합니다.
 */
export async function uploadReviewImage(file: File) {
  const preparedFile = await prepareReviewImageUpload(file);
  const body = new FormData();
  body.append('file', preparedFile);
  return fetchJson<UploadResponse>('/api/reviews/upload', {
    method: 'POST',
    body,
  });
}

/**
 * 마이페이지를 그리기 위한 사용자의 전체 통계 및 활동 내역(리뷰, 스탬프 로그 등)을 조회합니다.
 */
export function getMySummary() {
  return fetchJson<MyPageResponse>('/api/my/summary');
}

/**
 * 마이페이지의 '내가 쓴 댓글' 탭 목록을 페이지 단위로 조회합니다.
 */
export function getMyCommentsPage(params?: { cursor?: string | null; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params?.limit) {
    search.set('limit', String(params.limit));
  }
  const query = search.toString();
  return fetchJson<MyCommentPageResponse>(`/api/my/comments${query ? `?${query}` : ''}`);
}

/**
 * 장소 스탬프 적립을 요청하고 결과를 받습니다. (현장 반경 검증에 필요한 좌표 포함)
 */
export async function claimStamp(payload: StampClaimRequest) {
  const response = await fetchJson<StampState>('/api/stamps/toggle', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/map-bootstrap', '/api/my/summary', '/api/community-routes']);
  return response;
}

/**
 * 관리자 패널의 전체 통계 및 장소 목록 요약을 조회합니다.
 */
export function getAdminSummary() {
  return fetchJson<AdminSummaryResponse>('/api/admin/summary');
}

/**
 * 관리자 패널에서 개별 장소의 노출 상태 등을 갱신합니다.
 */
export async function updatePlaceVisibility(placeId: string, payload: PlaceVisibilityRequest) {
  const response = await fetchJson<AdminPlace>(`/api/admin/places/${placeId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/admin/summary', '/api/map-bootstrap']);
  return response;
}

/**
 * 공공 데이터를 최신 상태로 동기화(Import)해오도록 서버에 요청합니다.
 */
export async function importPublicData() {
  const response = await fetchJson<PublicImportResponse>('/api/admin/import/public-data', {
    method: 'POST',
  });
  invalidateApiCache(['/api/admin/summary', '/api/map-bootstrap', '/api/courses/curated', '/api/festivals']);
  return response;
}

/**
 * 홈 배너 화면 등에 표시할 공공 행사(축제) 일정 목록을 조회합니다.
 */
export function getPublicEventBanner() {
  return fetchJson<PublicEventBannerResponse>('/api/banner/events');
}

/**
 * 지도에 마커로 표시할 행사(축제) 데이터 목록을 조회합니다.
 */
export function getFestivals() {
  return fetchJson<FestivalItem[]>('/api/festivals');
}

/**
 * 장소나 커뮤니티 루트 등을 텍스트 키워드로 검색합니다.
 */
export function searchDiscovery(query: string) {
  return fetchJson<DiscoverySearchResponse>(`/api/discovery/search?q=${encodeURIComponent(query)}`);
}

/**
 * 특정 장소를 기준으로 한 추천 장소 목록을 반환합니다.
 */
export function getPlaceRecommendations(placeId: string) {
  return fetchJson<DiscoveryRecommendationsResponse>(`/api/discovery/recommendations?placeId=${encodeURIComponent(placeId)}`);
}


