import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNotificationActions } from '../../src/hooks/useNotificationActions';
import type { UserNotification } from '../../src/types';

function createNotification(overrides: Partial<UserNotification> = {}): UserNotification {
  return {
    id: 'notification-1',
    type: 'comment-reply',
    title: 'reply',
    body: 'A reply was posted.',
    createdAt: '04. 07. 10:15',
    isRead: false,
    reviewId: 'review-1',
    commentId: 'comment-1',
    routeId: null,
    actorName: 'tester',
    ...overrides,
  };
}

describe('useNotificationActions', () => {
  it('delegates mark and delete actions to the notification store', async () => {
    const markNotificationReadInStore = vi.fn().mockResolvedValue(undefined);
    const markAllNotificationsReadInStore = vi.fn().mockResolvedValue(undefined);
    const deleteNotificationInStore = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotificationActions({
      markNotificationReadInStore,
      markAllNotificationsReadInStore,
      deleteNotificationInStore,
      handleOpenCommentWithReturn: vi.fn(),
      handleOpenReviewWithReturn: vi.fn(),
      goToTab: vi.fn(),
      setMyPageTab: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleMarkNotificationRead('notification-1');
      await result.current.handleMarkAllNotificationsRead();
      await result.current.handleDeleteNotification('notification-2');
    });

    expect(markNotificationReadInStore).toHaveBeenCalledWith('notification-1');
    expect(markAllNotificationsReadInStore).toHaveBeenCalledTimes(1);
    expect(deleteNotificationInStore).toHaveBeenCalledWith('notification-2');
  });

  it('marks unread comment notifications before opening the target comment', async () => {
    const markNotificationReadInStore = vi.fn().mockResolvedValue(undefined);
    const handleOpenCommentWithReturn = vi.fn();

    const { result } = renderHook(() => useNotificationActions({
      markNotificationReadInStore,
      markAllNotificationsReadInStore: vi.fn(),
      deleteNotificationInStore: vi.fn(),
      handleOpenCommentWithReturn,
      handleOpenReviewWithReturn: vi.fn(),
      goToTab: vi.fn(),
      setMyPageTab: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleOpenGlobalNotification(createNotification());
    });

    expect(markNotificationReadInStore).toHaveBeenCalledWith('notification-1');
    expect(handleOpenCommentWithReturn).toHaveBeenCalledWith('review-1', 'comment-1');
  });

  it('opens a review notification without remarking an already-read item', async () => {
    const markNotificationReadInStore = vi.fn().mockResolvedValue(undefined);
    const handleOpenReviewWithReturn = vi.fn();

    const { result } = renderHook(() => useNotificationActions({
      markNotificationReadInStore,
      markAllNotificationsReadInStore: vi.fn(),
      deleteNotificationInStore: vi.fn(),
      handleOpenCommentWithReturn: vi.fn(),
      handleOpenReviewWithReturn,
      goToTab: vi.fn(),
      setMyPageTab: vi.fn(),
    }));

    await act(async () => {
      await result.current.handleOpenGlobalNotification(createNotification({
        isRead: true,
        commentId: null,
      }));
    });

    expect(markNotificationReadInStore).not.toHaveBeenCalled();
    expect(handleOpenReviewWithReturn).toHaveBeenCalledWith('review-1');
  });

  it('routes route notifications to my-page routes tab', async () => {
    const goToTab = vi.fn();
    const setMyPageTab = vi.fn();

    const { result } = renderHook(() => useNotificationActions({
      markNotificationReadInStore: vi.fn().mockResolvedValue(undefined),
      markAllNotificationsReadInStore: vi.fn(),
      deleteNotificationInStore: vi.fn(),
      handleOpenCommentWithReturn: vi.fn(),
      handleOpenReviewWithReturn: vi.fn(),
      goToTab,
      setMyPageTab,
    }));

    await act(async () => {
      await result.current.handleOpenGlobalNotification(createNotification({
        type: 'route-published',
        reviewId: null,
        commentId: null,
        routeId: 'route-1',
      }));
    });

    expect(goToTab).toHaveBeenCalledWith('my');
    expect(setMyPageTab).toHaveBeenCalledWith('routes');
  });
});
