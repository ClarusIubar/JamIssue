import { useEffect } from 'react';
import type { AdminSummaryResponse, MyPageResponse, SessionUser, Tab } from '../types';

interface UseAppTabWarmupParams {
  activeTab: Tab;
  sessionUser: SessionUser | null;
  myPage: MyPageResponse | null;
  myPageTab: string;
  adminSummary: AdminSummaryResponse | null;
  communityRouteSort: 'popular' | 'latest';
  myCommentsLoadedOnce: boolean;
  ensureFeedReviews: (force?: boolean) => Promise<void>;
  fetchCommunityRoutes: (sort: 'popular' | 'latest', force?: boolean) => Promise<unknown>;
  refreshMyPageForUser: (user: SessionUser | null, force?: boolean) => Promise<MyPageResponse | null>;
  refreshAdminSummary: (force?: boolean) => Promise<AdminSummaryResponse | null>;
  loadMoreMyComments: (initial?: boolean) => Promise<void>;
  reportBackgroundError: (error: unknown) => void;
}

export function useAppTabWarmup({
  activeTab,
  sessionUser,
  myPage,
  myPageTab,
  adminSummary,
  communityRouteSort,
  myCommentsLoadedOnce,
  ensureFeedReviews,
  fetchCommunityRoutes,
  refreshMyPageForUser,
  refreshAdminSummary,
  loadMoreMyComments,
  reportBackgroundError,
}: UseAppTabWarmupParams) {
  useEffect(() => {
    if (activeTab === 'feed') {
      void ensureFeedReviews().catch(reportBackgroundError);
      return;
    }

    if (activeTab === 'course') {
      void fetchCommunityRoutes(communityRouteSort).catch(reportBackgroundError);
      return;
    }

    if (activeTab === 'my') {
      if (sessionUser && myPage === null) {
        void refreshMyPageForUser(sessionUser, true).catch(reportBackgroundError);
      }
      if (sessionUser?.isAdmin && myPageTab === 'admin' && adminSummary === null) {
        void refreshAdminSummary().catch(reportBackgroundError);
      }
      if (sessionUser && myPage && myPageTab === 'comments' && !myCommentsLoadedOnce) {
        void loadMoreMyComments(true);
      }
    }
  }, [
    activeTab,
    adminSummary,
    communityRouteSort,
    ensureFeedReviews,
    fetchCommunityRoutes,
    loadMoreMyComments,
    myCommentsLoadedOnce,
    myPage,
    myPageTab,
    refreshAdminSummary,
    refreshMyPageForUser,
    reportBackgroundError,
    sessionUser,
  ]);
}
