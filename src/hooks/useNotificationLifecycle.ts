import { useEffect } from 'react';
import type { MyPageResponse, SessionUser } from '../types';

interface UseNotificationLifecycleParams {
  sessionUser: SessionUser | null;
  myPage: MyPageResponse | null;
  fetchNotifications: () => Promise<void>;
  connectNotifications: (sessionUser: SessionUser | null) => void;
  disconnectNotifications: () => void;
  hydrateNotifications: (notifications: MyPageResponse['notifications'], unreadCount?: number) => void;
}

export function useNotificationLifecycle({
  sessionUser,
  myPage,
  fetchNotifications,
  connectNotifications,
  disconnectNotifications,
  hydrateNotifications,
}: UseNotificationLifecycleParams) {
  useEffect(() => {
    if (!sessionUser) {
      disconnectNotifications();
      return;
    }

    connectNotifications(sessionUser);
    if (!myPage) {
      void fetchNotifications();
    }

    return () => {
      disconnectNotifications();
    };
  }, [
    connectNotifications,
    disconnectNotifications,
    fetchNotifications,
    sessionUser,
  ]);

  useEffect(() => {
    if (!sessionUser || !myPage) {
      return;
    }
    hydrateNotifications(myPage.notifications, myPage.unreadNotificationCount);
  }, [hydrateNotifications, myPage, sessionUser]);
}
