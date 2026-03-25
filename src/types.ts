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

/**
 * 현재 로그인한 사용자의 세션 정보를 나타내는 인터페이스입니다.
 */
export interface SessionUser {
  id: string;
  nickname: string;
  email: string | null;
  provider: string;
  profileImage: string | null;
  isAdmin: boolean;
  profileCompletedAt: string | null;
}

/**
 * 지원하는 소셜 로그인 제공자(OAuth)의 정보를 담는 인터페이스입니다.
 */
export interface AuthProvider {
  key: ProviderKey;
  label: string;
  isEnabled: boolean;
  loginUrl: string | null;
}

/**
 * 로그인 세션 상태 및 사용 가능한 인증 제공자를 함께 응답하는 통합 인터페이스입니다.
 */
export interface AuthSessionResponse {
  isAuthenticated: boolean;
  user: SessionUser | null;
  providers: AuthProvider[];
}

/**
 * 지도에 마커로 표시되거나 리스트에 노출되는 장소(Place) 정보 인터페이스입니다.
 */
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

/**
 * 사용자가 작성한 피드(리뷰)에 달린 댓글 모델입니다.
 * 대댓글(replies)을 자기 참조 형태로 가집니다.
 */
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

/**
 * 특정 장소에 방문한 후 스탬프 증빙을 통해 작성한 사용자의 후기(리뷰/피드) 인터페이스입니다.
 */
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

/**
 * 무한 스크롤(페이지네이션) 방식의 피드 조회 결과를 담는 응답 인터페이스입니다.
 */
export interface ReviewFeedPageResponse {
  items: Review[];
  nextCursor: string | null;
}

/**
 * 사용자의 단일 스탬프 획득 이력을 나타내는 로그 인터페이스입니다.
 */
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

/**
 * 사용자의 24시간 내 스탬프 획득 묶음을 나타내는 여행 세션 인터페이스입니다.
 */
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

/**
 * 리뷰 좋아요 상태 변경 시 서버에서 반환하는 결과 응답 인터페이스입니다.
 */
export interface ReviewLikeResponse {
  reviewId: string;
  likeCount: number;
  likedByMe: boolean;
}

/**
 * 운영자가 제공하는 공식 큐레이션 코스 정보를 담는 인터페이스입니다.
 */
export interface Course {
  id: string;
  title: string;
  mood: Exclude<CourseMood, '\uC804\uCCB4'>;
  duration: string;
  note: string;
  color: string;
  placeIds: string[];
}

/**
 * UI에서 커뮤니티 루트 목록이나 큐레이션 코스 목록을 렌더링하기 위해 가공하는 공통 프리뷰 인터페이스입니다.
 */
export interface RoutePreview {
  id: string;
  title: string;
  subtitle: string;
  mood: string;
  placeIds: string[];
  placeNames: string[];
}

/**
 * 사용자가 스탬프 기록(TravelSession)을 바탕으로 발행한 커뮤니티 루트 인터페이스입니다.
 */
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

/**
 * 사용자 루트 좋아요 상태 변경 시 서버에서 반환하는 결과 응답 인터페이스입니다.
 */
export interface UserRouteLikeResponse {
  routeId: string;
  likeCount: number;
  likedByMe: boolean;
}

/**
 * 공공데이터에서 가져온 개별 지역 축제나 행사의 정보를 나타내는 인터페이스입니다.
 */
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

/**
 * 현재 로그인한 사용자의 전체 스탬프 현황을 포함하는 통합 상태 인터페이스입니다.
 */
export interface StampState {
  collectedPlaceIds: string[];
  logs: StampLog[];
  travelSessions: TravelSession[];
}

/**
 * 애플리케이션 최초 구동 시 1회성으로 불러오는 모든 기초 데이터 목록을 담는 응답 모델입니다.
 */
export interface BootstrapResponse {
  auth: AuthSessionResponse;
  places: Place[];
  reviews: Review[];
  courses: Course[];
  stamps: StampState;
  hasRealData: boolean;
}

/**
 * 지도 화면 진입 시 최적화를 위해 최소한으로 로드하는 필수 데이터 응답 모델입니다.
 */
export interface MapBootstrapResponse {
  auth: AuthSessionResponse;
  places: Place[];
  stamps: StampState;
  hasRealData: boolean;
}

/**
 * 코스 탭 진입 시 지연 로드되는 코스 목록 데이터의 응답 모델입니다.
 */
export interface CourseBootstrapResponse {
  courses: Course[];
}

/**
 * 새로운 피드(리뷰)를 작성할 때 서버에 전달하는 요청 데이터 모델입니다.
 */
export interface ReviewCreateRequest {
  placeId: string;
  stampId: string;
  body: string;
  mood: ReviewMood;
  imageUrl?: string | null;
}

/**
 * 특정 피드에 댓글이나 대댓글을 작성할 때 전달하는 요청 데이터 모델입니다.
 */
export interface CommentCreateRequest {
  body: string;
  parentId?: string | null;
}

/**
 * 사용자 커뮤니티 루트 발행을 위해 서버에 전달하는 요청 데이터 모델입니다.
 */
export interface UserRouteCreateRequest {
  title: string;
  description: string;
  mood: string;
  travelSessionId: string;
  isPublic?: boolean;
}

/**
 * 스탬프 적립을 요청할 때 사용자의 현재 GPS 좌표와 대상 장소 ID를 함께 전달하는 모델입니다.
 */
export interface StampClaimRequest {
  placeId: string;
  latitude: number;
  longitude: number;
}

/**
 * 마이페이지의 '내가 쓴 댓글' 탭에서 사용할, 원본 리뷰 정보가 일부 포함된 댓글 인터페이스입니다.
 */
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

/**
 * 마이페이지 댓글 탭의 무한 스크롤 조회 결과를 담는 응답 인터페이스입니다.
 */
export interface MyCommentPageResponse {
  items: MyComment[];
  nextCursor: string | null;
}

/**
 * 마이페이지 상단에 표시될 사용자의 전체 누적 활동 통계를 담는 인터페이스입니다.
 */
export interface MyStats {
  reviewCount: number;
  stampCount: number;
  uniquePlaceCount: number;
  totalPlaceCount: number;
  routeCount: number;
}

/**
 * 마이페이지 진입 시 필요한 사용자 통계, 기록(스탬프, 리뷰, 루트) 정보를 모두 포함하는 응답 모델입니다.
 */
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

/**
 * 사용자 닉네임 등 프로필 업데이트 시 서버에 전송하는 요청 데이터 모델입니다.
 */
export interface ProfileUpdateRequest {
  nickname: string;
}

/**
 * 관리자 패널의 장소 목록에 출력될 최소한의 요약 정보 인터페이스입니다.
 */
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

/**
 * 관리자 대시보드 화면 렌더링에 필요한 총 통계 지표와 장소 목록을 담는 응답 모델입니다.
 */
export interface AdminSummaryResponse {
  userCount: number;
  placeCount: number;
  reviewCount: number;
  commentCount: number;
  stampCount: number;
  sourceReady: boolean;
  places: AdminPlace[];
}

/**
 * 관리자 패널에서 장소 노출 상태를 변경할 때 사용하는 요청 데이터 모델입니다.
 */
export interface PlaceVisibilityRequest {
  isActive?: boolean;
  isManualOverride?: boolean;
}

/**
 * 리뷰 이미지 등 파일을 스토리지에 성공적으로 업로드한 후 받는 응답 데이터 모델입니다.
 */
export interface UploadResponse {
  url: string;
  fileName: string;
  contentType: string;
}

/**
 * 공공데이터(장소/행사) 동기화 작업 완료 후 서버에서 반환하는 결과 통계 인터페이스입니다.
 */
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
