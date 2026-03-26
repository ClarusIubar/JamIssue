import { CourseTab } from './CourseTab';
import { EventTab } from './EventTab';
import { FeedTab } from './FeedTab';
import { MyPagePanel } from './MyPagePanel';
import type {
  AdminSummaryResponse,
  AuthProvider,
  CommunityRouteSort,
  Course,
  FestivalItem,
  MyPageResponse,
  MyPageTabKey,
  Review,
  ReviewMood,
  RoutePreview,
  SessionUser,
  Tab,
  UserRoute,
} from '../types';

interface AppPageStageProps {
  activeTab: Exclude<Tab, 'map'>;
  reviews: Review[];
  sessionUser: SessionUser | null;
  reviewLikeUpdatingId: string | null;
  feedPlaceFilterId: string | null;
  placeNameById: Record<string, string>;
  commentSubmittingReviewId: string | null;
  commentMutatingId: string | null;
  deletingReviewId: string | null;
  activeCommentReviewId: string | null;
  highlightedCommentId: string | null;
  highlightedReviewId: string | null;
  feedHasMore: boolean;
  feedLoadingMore: boolean;
  festivals: FestivalItem[];
  courses: Course[];
  communityRoutes: UserRoute[];
  communityRouteSort: CommunityRouteSort;
  routeLikeUpdatingId: string | null;
  myPage: MyPageResponse | null;
  providers: AuthProvider[];
  myPageError: string | null;
  myPageTab: MyPageTabKey;
  isLoggingOut: boolean;
  profileSaving: boolean;
  profileError: string | null;
  routeSubmitting: boolean;
  routeError: string | null;
  adminSummary: AdminSummaryResponse | null;
  adminBusyPlaceId: string | null;
  adminLoading: boolean;
  commentsHasMore: boolean;
  commentsLoadingMore: boolean;
  onLoadMoreFeed: () => Promise<void>;
  onToggleReviewLike: (reviewId: string) => Promise<void>;
  onCreateComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onUpdateComment: (reviewId: string, commentId: string, body: string) => Promise<void>;
  onDeleteComment: (reviewId: string, commentId: string) => Promise<void>;
  onDeleteReview: (reviewId: string) => Promise<void>;
  onRequestLogin: () => void;
  onClearPlaceFilter: () => void;
  onOpenPlace: (placeId: string) => void;
  onOpenComments: (reviewId: string, commentId?: string | null) => void;
  onCloseComments: () => void;
  onChangeRouteSort: (sort: CommunityRouteSort) => void;
  onToggleRouteLike: (routeId: string) => Promise<void>;
  onOpenRoutePreview: (route: RoutePreview) => void;
  onChangeMyPageTab: (tab: MyPageTabKey) => void;
  onLogin: (provider: 'naver' | 'kakao') => void;
  onRetryMyPage: () => Promise<void>;
  onLogout: () => Promise<void>;
  onSaveNickname: (nickname: string) => Promise<void>;
  onPublishRoute: (payload: { travelSessionId: string; title: string; description: string; mood: string }) => Promise<void>;
  onOpenCommentFromMyPage: (reviewId: string, commentId: string) => void;
  onOpenReview: (reviewId: string) => Promise<void>;
  onUpdateReview: (reviewId: string, payload: { body: string; mood: ReviewMood }) => Promise<void>;
  onMarkNotificationRead: (notificationId: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onDeleteNotification: (notificationId: string) => Promise<void>;
  onLoadMoreComments: (initial?: boolean) => Promise<void>;
  onRefreshAdmin: () => Promise<void>;
  onToggleAdminPlace: (placeId: string, nextValue: boolean) => Promise<void>;
  onToggleAdminManualOverride: (placeId: string, nextValue: boolean) => Promise<void>;
}

export function AppPageStage({
  activeTab,
  reviews,
  sessionUser,
  reviewLikeUpdatingId,
  feedPlaceFilterId,
  placeNameById,
  commentSubmittingReviewId,
  commentMutatingId,
  deletingReviewId,
  activeCommentReviewId,
  highlightedCommentId,
  highlightedReviewId,
  feedHasMore,
  feedLoadingMore,
  festivals,
  courses,
  communityRoutes,
  communityRouteSort,
  routeLikeUpdatingId,
  myPage,
  providers,
  myPageError,
  myPageTab,
  isLoggingOut,
  profileSaving,
  profileError,
  routeSubmitting,
  routeError,
  adminSummary,
  adminBusyPlaceId,
  adminLoading,
  commentsHasMore,
  commentsLoadingMore,
  onLoadMoreFeed,
  onToggleReviewLike,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onDeleteReview,
  onRequestLogin,
  onClearPlaceFilter,
  onOpenPlace,
  onOpenComments,
  onCloseComments,
  onChangeRouteSort,
  onToggleRouteLike,
  onOpenRoutePreview,
  onChangeMyPageTab,
  onLogin,
  onRetryMyPage,
  onLogout,
  onSaveNickname,
  onPublishRoute,
  onOpenCommentFromMyPage,
  onOpenReview,
  onUpdateReview,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  onLoadMoreComments,
  onRefreshAdmin,
  onToggleAdminPlace,
  onToggleAdminManualOverride,
}: AppPageStageProps) {
  return (
    <div className="page-stage">
      {activeTab === 'feed' && (
        <FeedTab
          reviews={reviews}
          sessionUser={sessionUser}
          reviewLikeUpdatingId={reviewLikeUpdatingId}
          placeFilterId={feedPlaceFilterId}
          placeFilterName={feedPlaceFilterId ? placeNameById[feedPlaceFilterId] ?? null : null}
          commentSubmittingReviewId={commentSubmittingReviewId}
          commentMutatingId={commentMutatingId}
          deletingReviewId={deletingReviewId}
          activeCommentReviewId={activeCommentReviewId}
          highlightedCommentId={highlightedCommentId}
          highlightedReviewId={highlightedReviewId}
          hasMore={feedHasMore && !feedPlaceFilterId}
          loadingMore={feedLoadingMore}
          onLoadMore={onLoadMoreFeed}
          onToggleReviewLike={onToggleReviewLike}
          onCreateComment={onCreateComment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
          onDeleteReview={onDeleteReview}
          onRequestLogin={onRequestLogin}
          onClearPlaceFilter={onClearPlaceFilter}
          onOpenPlace={onOpenPlace}
          onOpenComments={onOpenComments}
          onCloseComments={onCloseComments}
        />
      )}

      {activeTab === 'event' && <EventTab festivals={festivals} />}

      {activeTab === 'course' && (
        <CourseTab
          curatedCourses={courses}
          communityRoutes={communityRoutes}
          sort={communityRouteSort}
          sessionUser={sessionUser}
          routeLikeUpdatingId={routeLikeUpdatingId}
          placeNameById={placeNameById}
          onChangeSort={onChangeRouteSort}
          onToggleLike={onToggleRouteLike}
          onOpenPlace={onOpenPlace}
          onOpenRoutePreview={onOpenRoutePreview}
          onRequestLogin={onRequestLogin}
        />
      )}

      {activeTab === 'my' && (
        <MyPagePanel
          sessionUser={sessionUser}
          myPage={myPage}
          providers={providers}
          myPageError={myPageError}
          activeTab={myPageTab}
          isLoggingOut={isLoggingOut}
          profileSaving={profileSaving}
          profileError={profileError}
          routeSubmitting={routeSubmitting}
          routeError={routeError}
          adminSummary={adminSummary}
          adminBusyPlaceId={adminBusyPlaceId}
          adminLoading={adminLoading}
          onChangeTab={onChangeMyPageTab}
          onLogin={onLogin}
          onRetry={onRetryMyPage}
          onLogout={onLogout}
          onSaveNickname={onSaveNickname}
          onPublishRoute={onPublishRoute}
          onOpenPlace={onOpenPlace}
          onOpenComment={onOpenCommentFromMyPage}
          onOpenReview={onOpenReview}
          onUpdateReview={onUpdateReview}
          onDeleteReview={onDeleteReview}
          onMarkNotificationRead={onMarkNotificationRead}
          onMarkAllNotificationsRead={onMarkAllNotificationsRead}
          onDeleteNotification={onDeleteNotification}
          commentsHasMore={commentsHasMore}
          commentsLoadingMore={commentsLoadingMore}
          onLoadMoreComments={onLoadMoreComments}
          onRefreshAdmin={onRefreshAdmin}
          onToggleAdminPlace={onToggleAdminPlace}
          onToggleAdminManualOverride={onToggleAdminManualOverride}
        />
      )}
    </div>
  );
}
