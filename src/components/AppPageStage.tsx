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
  sharedData: {
    sessionUser: SessionUser | null;
    placeNameById: Record<string, string>;
    festivals: FestivalItem[];
  };
  feedData: {
    reviews: Review[];
    reviewLikeUpdatingId: string | null;
    feedPlaceFilterId: string | null;
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
  };
  courseData: {
    courses: Course[];
    communityRoutes: UserRoute[];
    communityRouteSort: CommunityRouteSort;
    routeLikeUpdatingId: string | null;
    highlightedRouteId: string | null;
  };
  myPageData: {
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
  };
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
    onOpenRouteFromMyPage: (routeId: string) => Promise<void>;
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
  sharedData,
  feedData,
  courseData,
  myPageData,
  sharedActions,
  feedActions,
  courseActions,
  myPageActions,
}: AppPageStageProps) {
  return (
    <div className="page-stage">
      {activeTab === 'feed' && (
        <FeedTab
          feedData={{
            reviews: feedData.reviews,
            placeFilterId: feedData.feedPlaceFilterId,
            placeFilterName: feedData.feedPlaceFilterId ? sharedData.placeNameById[feedData.feedPlaceFilterId] ?? null : null,
            highlightedReviewId: feedData.highlightedReviewId,
            reviewLikeUpdatingId: feedData.reviewLikeUpdatingId,
            hasMore: feedData.feedHasMore && !feedData.feedPlaceFilterId,
            loadingMore: feedData.feedLoadingMore,
          }}
          commentSheetData={{
            activeCommentReviewId: feedData.activeCommentReviewId,
            activeCommentReviewComments: feedData.activeCommentReviewComments,
            activeCommentReviewStatus: feedData.activeCommentReviewStatus,
            highlightedCommentId: feedData.highlightedCommentId,
            commentSubmittingReviewId: feedData.commentSubmittingReviewId,
            commentMutatingId: feedData.commentMutatingId,
            deletingReviewId: feedData.deletingReviewId,
          }}
          sharedData={{
            sessionUser: sharedData.sessionUser,
          }}
          feedActions={{
            onLoadMore: feedActions.onLoadMoreFeed,
            onToggleReviewLike: feedActions.onToggleReviewLike,
            onCreateComment: feedActions.onCreateComment,
            onUpdateComment: feedActions.onUpdateComment,
            onDeleteComment: feedActions.onDeleteComment,
            onDeleteReview: feedActions.onDeleteReview,
            onClearPlaceFilter: feedActions.onClearPlaceFilter,
            onOpenComments: feedActions.onOpenComments,
            onCloseComments: feedActions.onCloseComments,
          }}
          sharedActions={{
            onRequestLogin: sharedActions.onRequestLogin,
            onOpenPlace: sharedActions.onOpenPlace,
          }}
        />
      )}

      {activeTab === 'event' && <EventTab festivals={sharedData.festivals} />}

      {activeTab === 'course' && (
        <CourseTab
          courses={courseData.courses}
          communityRoutes={courseData.communityRoutes}
          sort={courseData.communityRouteSort}
          sessionUser={sharedData.sessionUser}
          routeLikeUpdatingId={courseData.routeLikeUpdatingId}
          highlightedRouteId={courseData.highlightedRouteId}
          placeNameById={sharedData.placeNameById}
          onChangeSort={courseActions.onChangeRouteSort}
          onToggleLike={courseActions.onToggleRouteLike}
          onOpenPlace={sharedActions.onOpenPlace}
          onOpenRoutePreview={courseActions.onOpenRoutePreview}
          onRequestLogin={sharedActions.onRequestLogin}
        />
      )}

      {activeTab === 'my' && (
        <MyPagePanel
          sessionData={{
            sessionUser: sharedData.sessionUser,
            myPage: myPageData.myPage,
            providers: myPageData.providers,
            myPageError: myPageData.myPageError,
          }}
          panelState={{
            activeTab: myPageData.myPageTab,
            isLoggingOut: myPageData.isLoggingOut,
            profileSaving: myPageData.profileSaving,
            profileError: myPageData.profileError,
            routeSubmitting: myPageData.routeSubmitting,
            routeError: myPageData.routeError,
            commentsHasMore: myPageData.commentsHasMore,
            commentsLoadingMore: myPageData.commentsLoadingMore,
          }}
          reviewActions={{
            onOpenPlace: sharedActions.onOpenPlace,
            onOpenComment: myPageActions.onOpenCommentFromMyPage,
            onOpenRoute: myPageActions.onOpenRouteFromMyPage,
            onOpenReview: myPageActions.onOpenReview,
            onUpdateReview: myPageActions.onUpdateReview,
            onDeleteReview: myPageActions.onDeleteReview,
            onLoadMoreComments: myPageActions.onLoadMoreComments,
          }}
          panelActions={{
            onChangeTab: myPageActions.onChangeMyPageTab,
            onLogin: myPageActions.onLogin,
            onRetry: myPageActions.onRetryMyPage,
            onLogout: myPageActions.onLogout,
            onSaveNickname: myPageActions.onSaveNickname,
            onPublishRoute: myPageActions.onPublishRoute,
          }}
          notificationActions={{
            onMarkNotificationRead: myPageActions.onMarkNotificationRead,
            onMarkAllNotificationsRead: myPageActions.onMarkAllNotificationsRead,
            onDeleteNotification: myPageActions.onDeleteNotification,
          }}
          adminData={{
            adminSummary: myPageData.adminSummary,
            adminBusyPlaceId: myPageData.adminBusyPlaceId,
            adminLoading: myPageData.adminLoading,
          }}
          adminActions={{
            onRefreshAdmin: myPageActions.onRefreshAdmin,
            onToggleAdminPlace: myPageActions.onToggleAdminPlace,
            onToggleAdminManualOverride: myPageActions.onToggleAdminManualOverride,
          }}
        />
      )}
    </div>
  );
});
