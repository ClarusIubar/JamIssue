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

function isGetRequest(init?: RequestInit) {
  return (init?.method ?? 'GET').toUpperCase() === 'GET' && !init?.body;
}

function clonePayload<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildCacheKey(path: string, init?: RequestInit) {
  const method = (init?.method ?? 'GET').toUpperCase();
  return method + ':' + path;
}

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

export function getApiBaseUrl() {
  return getClientConfig().apiBaseUrl;
}

export function getProviderLoginUrl(provider: ProviderKey, nextUrl: string, mode: 'login' | 'link' = 'login') {
  return `${getApiBaseUrl()}/api/auth/${provider}/login?next=${encodeURIComponent(nextUrl)}&mode=${mode}`;
}

export function getAuthSession() {
  return fetchJson<AuthSessionResponse>('/api/auth/me');
}

export async function logout() {
  const response = await fetchJson<AuthSessionResponse>('/api/auth/logout', {
    method: 'POST',
  });
  invalidateApiCache(['/api/auth/me', '/api/map-bootstrap', '/api/my/summary', '/api/community-routes', '/api/reviews']);
  return response;
}

export async function updateProfile(payload: ProfileUpdateRequest) {
  const response = await fetchJson<AuthSessionResponse>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/auth/me', '/api/my/summary', '/api/community-routes', '/api/reviews']);
  return response;
}

export function getBootstrap() {
  return fetchJson<BootstrapResponse>('/api/bootstrap');
}

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

export function getCommunityRoutes(sort: CommunityRouteSort = 'popular') {
  return fetchJson<UserRoute[]>(`/api/community-routes?sort=${sort}`);
}

export async function createUserRoute(payload: UserRouteCreateRequest) {
  const response = await fetchJson<UserRoute>('/api/community-routes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/community-routes', '/api/my/routes', '/api/my/summary']);
  return response;
}

export async function toggleCommunityRouteLike(routeId: string) {
  const response = await fetchJson<UserRouteLikeResponse>(`/api/community-routes/${routeId}/like`, {
    method: 'POST',
  });
  invalidateApiCache(['/api/community-routes', '/api/my/routes']);
  return response;
}

export function getMyRoutes() {
  return fetchJson<UserRoute[]>('/api/my/routes');
}

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

export function getReviewDetail(reviewId: string) {
  return fetchJson<Review>(`/api/reviews/${reviewId}`);
}

export async function createReview(payload: ReviewCreateRequest) {
  const response = await fetchJson<Review>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/reviews', '/api/my/summary']);
  return response;
}

export async function toggleReviewLike(reviewId: string) {
  const response = await fetchJson<ReviewLikeResponse>(`/api/reviews/${reviewId}/like`, {
    method: 'POST',
  });
  invalidateApiCache(['/api/reviews']);
  return response;
}

export function getReviewComments(reviewId: string) {
  return fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments`);
}

export async function createComment(reviewId: string, payload: CommentCreateRequest) {
  const response = await fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateApiCache([`/api/reviews/${reviewId}/comments`, '/api/reviews', '/api/my/summary']);
  return response;
}

export async function updateComment(reviewId: string, commentId: string, payload: { body: string }) {
  const response = await fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  invalidateApiCache([`/api/reviews/${reviewId}/comments`, '/api/reviews', '/api/my/summary']);
  return response;
}

export async function deleteComment(reviewId: string, commentId: string) {
  const response = await fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments/${commentId}`, {
    method: 'DELETE',
  });
  invalidateApiCache([`/api/reviews/${reviewId}/comments`, '/api/reviews', '/api/my/summary']);
  return response;
}

export async function deleteReview(reviewId: string) {
  const response = await fetchJson<{ reviewId: string; deleted: boolean }>(`/api/reviews/${reviewId}`, {
    method: 'DELETE',
  });
  invalidateApiCache(['/api/reviews', '/api/my/summary']);
  return response;
}

export async function uploadReviewImage(file: File) {
  const preparedFile = await prepareReviewImageUpload(file);
  const body = new FormData();
  body.append('file', preparedFile);
  return fetchJson<UploadResponse>('/api/reviews/upload', {
    method: 'POST',
    body,
  });
}

export function getMySummary() {
  return fetchJson<MyPageResponse>('/api/my/summary');
}

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

export async function claimStamp(payload: StampClaimRequest) {
  const response = await fetchJson<StampState>('/api/stamps/toggle', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/map-bootstrap', '/api/my/summary', '/api/community-routes']);
  return response;
}

export function getAdminSummary() {
  return fetchJson<AdminSummaryResponse>('/api/admin/summary');
}

export async function updatePlaceVisibility(placeId: string, payload: PlaceVisibilityRequest) {
  const response = await fetchJson<AdminPlace>(`/api/admin/places/${placeId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  invalidateApiCache(['/api/admin/summary', '/api/map-bootstrap']);
  return response;
}

export async function importPublicData() {
  const response = await fetchJson<PublicImportResponse>('/api/admin/import/public-data', {
    method: 'POST',
  });
  invalidateApiCache(['/api/admin/summary', '/api/map-bootstrap', '/api/courses/curated', '/api/festivals']);
  return response;
}

export function getPublicEventBanner() {
  return fetchJson<PublicEventBannerResponse>('/api/banner/events');
}

export function getFestivals() {
  return fetchJson<FestivalItem[]>('/api/festivals');
}

export function searchDiscovery(query: string) {
  return fetchJson<DiscoverySearchResponse>(`/api/discovery/search?q=${encodeURIComponent(query)}`);
}

export function getPlaceRecommendations(placeId: string) {
  return fetchJson<DiscoveryRecommendationsResponse>(`/api/discovery/recommendations?placeId=${encodeURIComponent(placeId)}`);
}


