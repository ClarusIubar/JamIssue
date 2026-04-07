import { useCallback } from 'react';
import type { MyPageTabKey, UserNotification } from '../types';

interface UseNotificationActionsParams {
  markNotificationReadInStore: (notificationId: string) => Promise<void>;
  markAllNotificationsReadInStore: () => Promise<void>;
  deleteNotificationInStore: (notificationId: string) => Promise<void>;
  handleOpenCommentWithReturn: (reviewId: string, commentId: string) => void;
  handleOpenReviewWithReturn: (reviewId: string) => void;
  goToTab: (tab: 'my') => void;
  setMyPageTab: (tab: MyPageTabKey) => void;
}

export function useNotificationActions({
  markNotificationReadInStore,
  markAllNotificationsReadInStore,
  deleteNotificationInStore,
  handleOpenCommentWithReturn,
  handleOpenReviewWithReturn,
  goToTab,
  setMyPageTab,
}: UseNotificationActionsParams) {
  const handleMarkNotificationRead = useCallback(async (notificationId: string) => {
    await markNotificationReadInStore(notificationId);
  }, [markNotificationReadInStore]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    await markAllNotificationsReadInStore();
  }, [markAllNotificationsReadInStore]);

  const handleDeleteNotification = useCallback(async (notificationId: string) => {
    await deleteNotificationInStore(notificationId);
  }, [deleteNotificationInStore]);

  const handleOpenGlobalNotification = useCallback(async (notification: UserNotification) => {
    if (!notification.isRead) {
      await markNotificationReadInStore(notification.id);
    }

    if (notification.reviewId && notification.commentId) {
      handleOpenCommentWithReturn(notification.reviewId, notification.commentId);
      return;
    }

    if (notification.reviewId) {
      handleOpenReviewWithReturn(notification.reviewId);
      return;
    }

    if (notification.routeId) {
      goToTab('my');
      setMyPageTab('routes');
    }
  }, [
    goToTab,
    handleOpenCommentWithReturn,
    handleOpenReviewWithReturn,
    markNotificationReadInStore,
    setMyPageTab,
  ]);

  return {
    handleMarkNotificationRead,
    handleMarkAllNotificationsRead,
    handleDeleteNotification,
    handleOpenGlobalNotification,
  };
}
