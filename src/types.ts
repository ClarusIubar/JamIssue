import type { PlaceCategory, PlaceCategoryFilter } from './lib/categories';

export type Category = PlaceCategoryFilter;
export type Tab = 'map' | 'feed' | 'course' | 'my';
export type MyPageTabKey = 'stamps' | 'feeds' | 'comments' | 'routes';
export type DrawerState = 'closed' | 'partial' | 'full';
export type ReviewMood = '혼자서' | '친구랑' | '데이트' | '야경 맛집';
export type CourseMood = '전체' | '데이트' | '사진' | '힐링' | '비 오는 날';
export type ApiStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ProviderKey = 'naver' | 'kakao';
export type CommunityRouteSort = 'popular' | 'latest';

export interface SessionUser {
  id: string;
  nickname: string;
  email: string | null;
  provider: string;
  profileImage: string | null;
  isAdmin: boolean;
  profileCompletedAt: string | null;
}

export interface AuthProvider {
  key: ProviderKey;
  label: string;
  isEnabled: boolean;
  loginUrl: string | null;
}

export interface AuthSessionResponse {
  isAuthenticated: boolean;
  user: SessionUser | null;
  providers: AuthProvider[];
}

export interface Place {
  id: string;
  positionId?: string;
  name: string;
  district: string;
  category: PlaceCategory;
  jamColor: string;
  accentColor: string;
  imageUrl?: string | null;
  latitude: number;
  longitude: number;
  summary: string;
  description: string;
  vibeTags: string[];
  visitTime: string;
  routeHint: string;
  stampReward: string;
  heroLabel: string;
}

export interface Comment {
  id: string;
  userId: string;
  author: string;
  body: string;
  parentId: string | null;
  isDeleted: boolean;
  createdAt: string;
  replies: Comment[];
}

export interface Review {
  id: string;
  userId: string;
  placeId: string;
  placeName: string;
  author: string;
  body: string;
  mood: ReviewMood;
  badge: string;
  visitedAt: string;
  imageUrl: string | null;
  commentCount: number;
  likeCount: number;
  likedByMe: boolean;
  stampId: string | null;
  visitNumber: number;
  visitLabel: string;
  travelSessionId: string | null;
  comments: Comment[];
}

export interface StampLog {
  id: string;
  placeId: string;
  placeName: string;
  stampedAt: string;
  stampedDate: string;
  visitNumber: number;
  visitLabel: string;
  travelSessionId: string | null;
  isToday: boolean;
}

export interface TravelSession {
  id: string;
  startedAt: string;
  endedAt: string;
  durationLabel: string;
  stampCount: number;
  placeIds: string[];
  placeNames: string[];
  canPublish: boolean;
  publishedRouteId: string | null;
  coverPlaceId: string | null;
}

export interface ReviewLikeResponse {
  reviewId: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface Course {
  id: string;
  title: string;
  mood: Exclude<CourseMood, '전체'>;
  duration: string;
  note: string;
  color: string;
  placeIds: string[];
}

export interface UserRoute {
  id: string;
  authorId: string;
  author: string;
  title: string;
  description: string;
  mood: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  placeIds: string[];
  placeNames: string[];
  isUserGenerated: boolean;
  travelSessionId: string | null;
}

export interface UserRouteLikeResponse {
  routeId: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface FestivalItem {
  id: string;
  title: string;
  venueName: string | null;
  startDate: string;
  endDate: string;
  homepageUrl: string | null;
  roadAddress: string | null;
  latitude: number;
  longitude: number;
  isOngoing: boolean;
}

export interface StampState {
  collectedPlaceIds: string[];
  logs: StampLog[];
  travelSessions: TravelSession[];
}

export interface BootstrapResponse {
  places: Place[];
  reviews: Review[];
  courses: Course[];
  stamps: StampState;
  hasRealData: boolean;
}

export interface ReviewCreateRequest {
  placeId: string;
  stampId: string;
  body: string;
  mood: ReviewMood;
  imageUrl?: string | null;
}

export interface CommentCreateRequest {
  body: string;
  parentId?: string | null;
}

export interface UserRouteCreateRequest {
  title: string;
  description: string;
  mood: string;
  travelSessionId: string;
  isPublic?: boolean;
}

export interface StampClaimRequest {
  placeId: string;
  latitude: number;
  longitude: number;
}

export interface MyComment {
  id: string;
  reviewId: string;
  placeId: string;
  placeName: string;
  body: string;
  isDeleted: boolean;
  parentId: string | null;
  createdAt: string;
  reviewBody: string;
}
export interface MyStats {
  reviewCount: number;
  stampCount: number;
  uniquePlaceCount: number;
  totalPlaceCount: number;
  routeCount: number;
}

export interface MyPageResponse {
  user: SessionUser;
  stats: MyStats;
  reviews: Review[];
  comments: MyComment[];
  stampLogs: StampLog[];
  travelSessions: TravelSession[];
  visitedPlaces: Place[];
  unvisitedPlaces: Place[];
  collectedPlaces: Place[];
  routes: UserRoute[];
}

export interface ProfileUpdateRequest {
  nickname: string;
}

export interface AdminPlace {
  id: string;
  name: string;
  district: string;
  category: PlaceCategory;
  isActive: boolean;
  reviewCount: number;
  updatedAt: string;
}

export interface AdminSummaryResponse {
  userCount: number;
  placeCount: number;
  reviewCount: number;
  commentCount: number;
  stampCount: number;
  sourceReady: boolean;
  places: AdminPlace[];
}

export interface PlaceVisibilityRequest {
  isActive: boolean;
}

export interface UploadResponse {
  url: string;
  fileName: string;
  contentType: string;
}

export interface PublicImportResponse {
  importedPlaces: number;
  importedCourses: number;
}

export interface RoadmapBannerSummaryItem {
  label: string;
  value: string;
  tone: 'pink' | 'blue' | 'mint';
}

export interface RoadmapBannerMilestone {
  id: string;
  dateLabel: string;
  statusLabel: string;
  title: string;
  body: string;
  deliverable: string;
}



