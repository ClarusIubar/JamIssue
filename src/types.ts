export type Category = 'all' | 'landmark' | 'food' | 'cafe' | 'night';
export type Tab = 'explore' | 'course' | 'stamp' | 'my';
export type ReviewMood = '설렘' | '친구랑' | '혼자서' | '야경픽';
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
  name: string;
  district: string;
  category: Exclude<Category, 'all'>;
  jamColor: string;
  accentColor: string;
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
  comments: Comment[];
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
}

export interface UserRouteLikeResponse {
  routeId: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface StampState {
  collectedPlaceIds: string[];
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
  body: string;
  mood: ReviewMood;
  imageUrl?: string | null;
  latitude: number;
  longitude: number;
}

export interface CommentCreateRequest {
  body: string;
  parentId?: string | null;
}

export interface UserRouteCreateRequest {
  title: string;
  description: string;
  mood: string;
  placeIds: string[];
  isPublic?: boolean;
}

export interface StampToggleRequest {
  placeId: string;
  latitude: number;
  longitude: number;
}

export interface MyStats {
  reviewCount: number;
  stampCount: number;
  routeCount: number;
}

export interface MyPageResponse {
  user: SessionUser;
  stats: MyStats;
  reviews: Review[];
  collectedPlaces: Place[];
  routes: UserRoute[];
}

export interface AdminPlace {
  id: string;
  name: string;
  district: string;
  category: Exclude<Category, 'all'>;
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
  tags: string[];
  accentColor: string;
  badgeTone: 'pink' | 'blue' | 'mint' | 'peach';
}

export interface RoadmapBannerSchema {
  eyebrow: string;
  title: string;
  subtitle: string;
  helper: string;
  summaryItems: RoadmapBannerSummaryItem[];
  milestones: RoadmapBannerMilestone[];
  closingNote: string;
}
