import { useNotificationActions } from './useNotificationActions';
import { useNotificationLifecycle } from './useNotificationLifecycle';
import { useNotificationStore } from '../store/notification-store';
import type { MyPageResponse, MyPageTabKey, SessionUser } from '../types';

interface UseGlobalNotificationsParams {
  sessionUser: SessionUser | null;
  myPage: MyPageResponse | null;
  goToTab: (tab: 'my') => void;
  setMyPageTab: (tab: MyPageTabKey) => void;
  handleOpenCommentWithReturn: (reviewId: string, commentId: string) => void;
  handleOpenReviewWithReturn: (reviewId: string) => void;
}

export function useGlobalNotifications({
  sessionUser,
  myPage,
  goToTab,
  setMyPageTab,
  handleOpenCommentWithReturn,
  handleOpenReviewWithReturn,
}: UseGlobalNotificationsParams) {
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadNotificationCount = useNotificationStore((state) => state.unreadCount);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const connectNotifications = useNotificationStore((state) => state.connect);
  const disconnectNotifications = useNotificationStore((state) => state.disconnect);
  const hydrateNotifications = useNotificationStore((state) => state.hydrate);
  const markNotificationReadInStore = useNotificationStore((state) => state.markRead);
  const markAllNotificationsReadInStore = useNotificationStore((state) => state.markAllRead);
  const deleteNotificationInStore = useNotificationStore((state) => state.deleteNotification);

  useNotificationLifecycle({
    sessionUser,
    myPage,
    fetchNotifications,
    connectNotifications,
    disconnectNotifications,
    hydrateNotifications,
  });

  const actions = useNotificationActions({
    markNotificationReadInStore,
    markAllNotificationsReadInStore,
    deleteNotificationInStore,
    handleOpenCommentWithReturn,
    handleOpenReviewWithReturn,
    goToTab,
    setMyPageTab,
  });

  return {
    notifications,
    unreadNotificationCount,
    ...actions,
  };
}
