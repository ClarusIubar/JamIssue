import { getClientConfig } from '../config';
import type {
  AdminPlace,
  AdminSummaryResponse,
  AuthSessionResponse,
  BootstrapResponse,
  CourseBootstrapResponse,
  MapBootstrapResponse,
  Comment,
  CommentCreateRequest,
  CommunityRouteSort,
  MyPageResponse,
  PlaceVisibilityRequest,
  ProfileUpdateRequest,
  ProviderKey,
  PublicImportResponse,
  Review,
  ReviewCreateRequest,
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

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiBaseUrl } = getClientConfig();
  const headers = new Headers(init?.headers || undefined);
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;

  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers,
  });

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
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
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

export function logout() {
  return fetchJson<AuthSessionResponse>('/api/auth/logout', {
    method: 'POST',
  });
}

export function updateProfile(payload: ProfileUpdateRequest) {
  return fetchJson<AuthSessionResponse>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function getBootstrap() {
  return fetchJson<BootstrapResponse>('/api/bootstrap');
}

export function getMapBootstrap() {
  return fetchJson<MapBootstrapResponse>('/api/map-bootstrap');
}

export function getCuratedCourses() {
  return fetchJson<CourseBootstrapResponse>('/api/courses/curated');
}

export function getCommunityRoutes(sort: CommunityRouteSort = 'popular') {
  return fetchJson<UserRoute[]>(`/api/community-routes?sort=${sort}`);
}

export function createUserRoute(payload: UserRouteCreateRequest) {
  return fetchJson<UserRoute>('/api/community-routes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function toggleCommunityRouteLike(routeId: string) {
  return fetchJson<UserRouteLikeResponse>(`/api/community-routes/${routeId}/like`, {
    method: 'POST',
  });
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

export function createReview(payload: ReviewCreateRequest) {
  return fetchJson<Review>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function toggleReviewLike(reviewId: string) {
  return fetchJson<ReviewLikeResponse>(`/api/reviews/${reviewId}/like`, {
    method: 'POST',
  });
}

export function getReviewComments(reviewId: string) {
  return fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments`);
}

export function createComment(reviewId: string, payload: CommentCreateRequest) {
  return fetchJson<Comment[]>(`/api/reviews/${reviewId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadReviewImage(file: File) {
  const body = new FormData();
  body.append('file', file);
  return fetchJson<UploadResponse>('/api/reviews/upload', {
    method: 'POST',
    body,
  });
}

export function getMySummary() {
  return fetchJson<MyPageResponse>('/api/my/summary');
}

export function claimStamp(payload: StampClaimRequest) {
  return fetchJson<StampState>('/api/stamps/toggle', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getAdminSummary() {
  return fetchJson<AdminSummaryResponse>('/api/admin/summary');
}

export function updatePlaceVisibility(placeId: string, payload: PlaceVisibilityRequest) {
  return fetchJson<AdminPlace>(`/api/admin/places/${placeId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function importPublicData() {
  return fetchJson<PublicImportResponse>('/api/admin/import/public-data', {
    method: 'POST',
  });
}

export function getPublicEventBanner() {
  return fetchJson<PublicEventBannerResponse>('/api/banner/events');
}

export function getFestivals() {
  return fetchJson<FestivalItem[]>('/api/festivals');
}

