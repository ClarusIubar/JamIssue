import type { PlaceCategory, PlaceCategoryFilter } from './lib/categories';

export type Category = PlaceCategoryFilter;
export type Tab = 'map' | 'event' | 'feed' | 'course' | 'my';
export type MyPageTabKey = 'stamps' | 'feeds' | 'comments' | 'routes' | 'admin';
export type DrawerState = 'closed' | 'partial' | 'full';
export type ReviewMood = '\uD63C\uC790\uC11C' | '\uCE5C\uAD6C\uB791' | '\uB370\uC774\uD2B8' | '\uC57C\uACBD \uB9DB\uC9D1';
export type CourseMood = '\uC804\uCCB4' | '\uB370\uC774\uD2B8' | '\uC0AC\uC9C4' | '\uD790\uB9C1' | '\uBE44 \uC624\uB294 \uB0A0';
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

export interface ReviewFeedPageResponse {
  items: Review[];
  nextCursor: string | null;
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
  travelSessionStampCount: number;
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
  mood: Exclude<CourseMood, '\uC804\uCCB4'>;
  duration: string;
  note: string;
  color: string;
  placeIds: string[];
}

export interface RoutePreview {
  id: string;
  title: string;
  subtitle: string;
  mood: string;
  placeIds: string[];
  placeNames: string[];
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
  latitude: number | null;
  longitude: number | null;
  isOngoing: boolean;
}

export interface StampState {
  collectedPlaceIds: string[];
  logs: StampLog[];
  travelSessions: TravelSession[];
}

export interface BootstrapResponse {
  auth: AuthSessionResponse;
  places: Place[];
  reviews: Review[];
  courses: Course[];
  stamps: StampState;
  hasRealData: boolean;
}

export interface MapBootstrapResponse {
  auth: AuthSessionResponse;
  places: Place[];
  stamps: StampState;
  hasRealData: boolean;
}

export interface CourseBootstrapResponse {
  courses: Course[];
}

export interface ReviewCreateRequest {
  placeId: string;
  stampId: string;
  body: string;
  mood: ReviewMood;
  imageUrl?: string | null;
}

export interface ReviewUpdateRequest {
  body: string;
  mood: ReviewMood;
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

export interface MyCommentPageResponse {
  items: MyComment[];
  nextCursor: string | null;
}

export interface MyStats {
  reviewCount: number;
  stampCount: number;
  uniquePlaceCount: number;
  totalPlaceCount: number;
  routeCount: number;
}

export type UserNotificationType =
  | 'review-created'
  | 'route-published'
  | 'review-comment'
  | 'comment-reply';

export interface UserNotification {
  id: string;
  type: UserNotificationType;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  reviewId: string | null;
  commentId: string | null;
  routeId: string | null;
  actorName: string | null;
}

export interface MyPageResponse {
  user: SessionUser;
  stats: MyStats;
  reviews: Review[];
  comments: MyComment[];
  notifications: UserNotification[];
  unreadNotificationCount: number;
  stampLogs: StampLog[];
  travelSessions: TravelSession[];
  visitedPlaces: Place[];
  unvisitedPlaces: Place[];
  collectedPlaces: Place[];
  routes: UserRoute[];
}

export interface NotificationReadResponse {
  notificationId: string;
  read: boolean;
}

export interface NotificationDeleteResponse {
  notificationId: string;
  deleted: boolean;
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
  isManualOverride: boolean;
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
  isActive?: boolean;
  isManualOverride?: boolean;
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
export interface DiscoverySearchResponse {
  query: string;
  places: Place[];
  routes: UserRoute[];
}

export interface PlaceRecommendation {
  place: Place;
  score: number;
  reason: string;
}

export interface DiscoveryRecommendationsResponse {
  placeId: string;
  items: PlaceRecommendation[];
}
