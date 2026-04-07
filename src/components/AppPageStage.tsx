import { memo } from 'react';
import { CourseTab } from './CourseTab';
import { EventTab } from './EventTab';
import { FeedTab } from './FeedTab';
import { MyPagePanel } from './MyPagePanel';
import type {
  AdminSummaryResponse,
  ApiStatus,
  AuthProvider,
  Comment,
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
  activeCommentReviewComments: Comment[];
  activeCommentReviewStatus: ApiStatus;
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
  sharedActions: {
    onRequestLogin: () => void;
    onOpenPlace: (placeId: string) => void;
  };
  feedActions: {
    onLoadMoreFeed: () => Promise<void>;
    onToggleReviewLike: (reviewId: string) => Promise<void>;
    onCreateComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
    onUpdateComment: (reviewId: string, commentId: string, body: string) => Promise<void>;
    onDeleteComment: (reviewId: string, commentId: string) => Promise<void>;
    onDeleteReview: (reviewId: string) => Promise<void>;
    onClearPlaceFilter: () => void;
    onOpenComments: (reviewId: string, commentId?: string | null) => void;
    onCloseComments: () => void;
  };
  courseActions: {
    onChangeRouteSort: (sort: CommunityRouteSort) => void;
    onToggleRouteLike: (routeId: string) => Promise<void>;
    onOpenRoutePreview: (route: RoutePreview) => void;
  };
  myPageActions: {
    onChangeMyPageTab: (tab: MyPageTabKey) => void;
    onLogin: (provider: 'naver' | 'kakao') => void;
    onRetryMyPage: () => Promise<void>;
    onLogout: () => Promise<void>;
    onSaveNickname: (nickname: string) => Promise<void>;
    onPublishRoute: (payload: { travelSessionId: string; title: string; description: string; mood: string }) => Promise<void>;
    onOpenCommentFromMyPage: (reviewId: string, commentId: string) => void;
    onOpenReview: (reviewId: string) => Promise<void>;
    onUpdateReview: (reviewId: string, payload: { body: string; mood: ReviewMood; file?: File | null; removeImage?: boolean }) => Promise<void>;
    onDeleteReview: (reviewId: string) => Promise<void>;
    onMarkNotificationRead: (notificationId: string) => Promise<void>;
    onMarkAllNotificationsRead: () => Promise<void>;
    onDeleteNotification: (notificationId: string) => Promise<void>;
    onLoadMoreComments: (initial?: boolean) => Promise<void>;
    onRefreshAdmin: () => Promise<void>;
    onToggleAdminPlace: (placeId: string, nextValue: boolean) => Promise<void>;
    onToggleAdminManualOverride: (placeId: string, nextValue: boolean) => Promise<void>;
  };
}

export const AppPageStage = memo(function AppPageStage({
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
  activeCommentReviewComments,
  activeCommentReviewStatus,
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
  sharedActions,
  feedActions,
  courseActions,
  myPageActions,
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
          activeCommentReviewComments={activeCommentReviewComments}
          activeCommentReviewStatus={activeCommentReviewStatus}
          highlightedCommentId={highlightedCommentId}
          highlightedReviewId={highlightedReviewId}
          hasMore={feedHasMore && !feedPlaceFilterId}
          loadingMore={feedLoadingMore}
          onLoadMore={feedActions.onLoadMoreFeed}
          onToggleReviewLike={feedActions.onToggleReviewLike}
          onCreateComment={feedActions.onCreateComment}
          onUpdateComment={feedActions.onUpdateComment}
          onDeleteComment={feedActions.onDeleteComment}
          onDeleteReview={feedActions.onDeleteReview}
          onRequestLogin={sharedActions.onRequestLogin}
          onClearPlaceFilter={feedActions.onClearPlaceFilter}
          onOpenPlace={sharedActions.onOpenPlace}
          onOpenComments={feedActions.onOpenComments}
          onCloseComments={feedActions.onCloseComments}
        />
      )}

      {activeTab === 'event' && <EventTab festivals={festivals} />}

      {activeTab === 'course' && (
        <CourseTab
          courses={courses}
          communityRoutes={communityRoutes}
          sort={communityRouteSort}
          sessionUser={sessionUser}
          routeLikeUpdatingId={routeLikeUpdatingId}
          placeNameById={placeNameById}
          onChangeSort={courseActions.onChangeRouteSort}
          onToggleLike={courseActions.onToggleRouteLike}
          onOpenPlace={sharedActions.onOpenPlace}
          onOpenRoutePreview={courseActions.onOpenRoutePreview}
          onRequestLogin={sharedActions.onRequestLogin}
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
          onChangeTab={myPageActions.onChangeMyPageTab}
          onLogin={myPageActions.onLogin}
          onRetry={myPageActions.onRetryMyPage}
          onLogout={myPageActions.onLogout}
          onSaveNickname={myPageActions.onSaveNickname}
          onPublishRoute={myPageActions.onPublishRoute}
          onOpenPlace={sharedActions.onOpenPlace}
          onOpenComment={myPageActions.onOpenCommentFromMyPage}
          onOpenReview={myPageActions.onOpenReview}
          onUpdateReview={myPageActions.onUpdateReview}
          onDeleteReview={myPageActions.onDeleteReview}
          onMarkNotificationRead={myPageActions.onMarkNotificationRead}
          onMarkAllNotificationsRead={myPageActions.onMarkAllNotificationsRead}
          onDeleteNotification={myPageActions.onDeleteNotification}
          commentsHasMore={commentsHasMore}
          commentsLoadingMore={commentsLoadingMore}
          onLoadMoreComments={myPageActions.onLoadMoreComments}
          onRefreshAdmin={myPageActions.onRefreshAdmin}
          onToggleAdminPlace={myPageActions.onToggleAdminPlace}
          onToggleAdminManualOverride={myPageActions.onToggleAdminManualOverride}
        />
      )}
    </div>
  );
});
