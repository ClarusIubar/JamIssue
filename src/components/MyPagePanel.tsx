import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { useAutoLoadMore } from '../hooks/useAutoLoadMore';
import { MyCommentsTabSection } from './my-page/MyCommentsTabSection';
import { MyFeedTabSection } from './my-page/MyFeedTabSection';
import { MyRoutesTabSection } from './my-page/MyRoutesTabSection';
import { MyStampTabSection } from './my-page/MyStampTabSection';
import { ProviderButtons } from './ProviderButtons';
import type { AdminSummaryResponse, AuthProvider, MyPageResponse, MyPageTabKey, ReviewMood, SessionUser } from '../types';

interface MyPagePanelProps {
  sessionData: {
    sessionUser: SessionUser | null;
    myPage: MyPageResponse | null;
    providers: AuthProvider[];
    myPageError: string | null;
  };
  panelState: {
    activeTab: MyPageTabKey;
    isLoggingOut: boolean;
    profileSaving: boolean;
    profileError: string | null;
    routeSubmitting: boolean;
    routeError: string | null;
    commentsHasMore: boolean;
    commentsLoadingMore: boolean;
  };
  reviewActions: {
    onOpenPlace: (placeId: string) => void;
    onOpenComment: (reviewId: string, commentId: string) => void;
    onOpenRoute: (routeId: string) => Promise<void>;
    onOpenReview: (reviewId: string) => void;
    onUpdateReview: (reviewId: string, payload: { body: string; mood: ReviewMood; file?: File | null; removeImage?: boolean }) => Promise<void>;
    onDeleteReview: (reviewId: string) => Promise<void>;
    onLoadMoreComments: (initial?: boolean) => Promise<void>;
  };
  panelActions: {
    onChangeTab: (nextTab: MyPageTabKey) => void;
    onLogin: (provider: 'naver' | 'kakao') => void;
    onRetry: () => Promise<void>;
    onLogout: () => Promise<void>;
    onSaveNickname: (nickname: string) => Promise<void>;
    onPublishRoute: (payload: { travelSessionId: string; title: string; description: string; mood: string }) => Promise<void>;
  };
  notificationActions: {
    onMarkNotificationRead: (notificationId: string) => Promise<void>;
    onMarkAllNotificationsRead: () => Promise<void>;
    onDeleteNotification: (notificationId: string) => Promise<void>;
  };
  adminData: {
    adminSummary: AdminSummaryResponse | null;
    adminBusyPlaceId: string | null;
    adminLoading: boolean;
  };
  adminActions: {
    onRefreshAdmin: () => Promise<void>;
    onToggleAdminPlace: (placeId: string, nextValue: boolean) => Promise<void>;
    onToggleAdminManualOverride: (placeId: string, nextValue: boolean) => Promise<void>;
  };
}

const AdminPanel = lazy(() => import('./AdminPanel').then((module) => ({ default: module.AdminPanel })));

type NotificationItem = NonNullable<MyPageResponse>['notifications'][number];

function getNotificationLabel(notification: NotificationItem) {
  switch (notification.type) {
    case 'review-created':
      return '피드';
    case 'route-published':
      return '코스';
    case 'review-comment':
      return '댓글';
    case 'comment-reply':
      return '답글';
    default:
      return '알림';
  }
}

export function MyPagePanel({
  sessionData,
  panelState,
  reviewActions,
  panelActions,
  notificationActions,
  adminData,
  adminActions,
}: MyPagePanelProps) {
  const { sessionUser, myPage, providers, myPageError } = sessionData;
  const {
    activeTab,
    isLoggingOut,
    profileSaving,
    profileError,
    routeSubmitting,
    routeError,
    commentsHasMore,
    commentsLoadingMore,
  } = panelState;
  const {
    onOpenPlace,
    onOpenComment,
    onOpenRoute,
    onOpenReview,
    onUpdateReview,
    onDeleteReview,
    onLoadMoreComments,
  } = reviewActions;
  const {
    onChangeTab,
    onLogin,
    onRetry,
    onLogout,
    onSaveNickname,
    onPublishRoute,
  } = panelActions;
  const {
    onMarkNotificationRead,
    onMarkAllNotificationsRead,
    onDeleteNotification,
  } = notificationActions;
  const { adminSummary, adminBusyPlaceId, adminLoading } = adminData;
  const { onRefreshAdmin, onToggleAdminPlace, onToggleAdminManualOverride } = adminActions;
  const [nickname, setNickname] = useState(sessionUser?.nickname ?? '');
  const [showVisitedDetail, setShowVisitedDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationBusyId, setNotificationBusyId] = useState<string | null>(null);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const scrollRef = useScrollRestoration<HTMLElement>(`my:${activeTab}`);
  const commentsLoadMoreRef = useAutoLoadMore({
    enabled: activeTab === 'comments' && commentsHasMore,
    loading: commentsLoadingMore,
    onLoadMore: () => onLoadMoreComments(),
    rootRef: scrollRef,
  });

  useEffect(() => {
    setNickname(sessionUser?.nickname ?? '');
    if (sessionUser && !sessionUser.profileCompletedAt) {
      setShowSettings(true);
    }
  }, [sessionUser?.nickname, sessionUser?.profileCompletedAt]);

  useEffect(() => {
    if (!myPage) {
      setShowNotifications(false);
    }
  }, [myPage]);

  const visitPct = useMemo(
    () => (myPage && myPage.stats.totalPlaceCount > 0
      ? Math.round((myPage.stats.uniquePlaceCount / myPage.stats.totalPlaceCount) * 100)
      : 0),
    [myPage],
  );
  const unreadNotificationCount = myPage?.unreadNotificationCount ?? 0;

  async function handleNicknameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSaveNickname(nickname.trim());
    setShowSettings(false);
  }

  async function handleOpenNotification(notification: NotificationItem) {
    try {
      setNotificationBusyId(notification.id);
      setNotificationError(null);
      if (!notification.isRead) {
        await onMarkNotificationRead(notification.id);
      }

      if (notification.reviewId && notification.commentId) {
        onOpenComment(notification.reviewId, notification.commentId);
        setShowNotifications(false);
        return;
      }
      if (notification.reviewId) {
        onOpenReview(notification.reviewId);
        setShowNotifications(false);
        return;
      }
      if (notification.routeId) {
        onChangeTab('routes');
        setShowNotifications(false);
      }
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : '알림을 열지 못했어요.');
    } finally {
      setNotificationBusyId(null);
    }
  }

  async function handleDeleteNotificationClick(event: React.MouseEvent<HTMLButtonElement>, notificationId: string) {
    event.stopPropagation();
    try {
      setNotificationBusyId(notificationId);
      setNotificationError(null);
      await onDeleteNotification(notificationId);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : '알림을 삭제하지 못했어요.');
    } finally {
      setNotificationBusyId(null);
    }
  }

  async function handleMarkAllNotifications() {
    try {
      setNotificationsBusy(true);
      setNotificationError(null);
      await onMarkAllNotificationsRead();
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : '알림 상태를 바꾸지 못했어요.');
    } finally {
      setNotificationsBusy(false);
    }
  }

  if (!sessionUser) {
    return (
      <section ref={scrollRef} className="page-panel page-panel--scrollable">
        <header className="panel-header">
          <p className="eyebrow">MY PAGE</p>
          <h2>로그인하고 기록 이어보기</h2>
          <p>스탬프, 피드, 코스를 계정 기준으로 이어보려면 먼저 로그인해 주세요.</p>
        </header>
        <section className="sheet-card stack-gap">
          <ProviderButtons providers={providers} onLogin={onLogin} />
        </section>
      </section>
    );
  }

  return (
    <section ref={scrollRef} className="page-panel page-panel--scrollable">
      <header className="panel-header panel-header--with-action">
        <div>
          <p className="eyebrow">MY PAGE</p>
          <h2>{sessionUser.nickname}님의 기록</h2>
          <p>
            스탬프와 피드, 댓글을 확인할 수 있고,
            <br />
            하나의 여행 세션을 코스로 발행할 수 있어요.
          </p>
        </div>
      </header>

      {!myPage && myPageError && (
        <section className="sheet-card stack-gap">
          <div>
            <p className="eyebrow">MY PAGE</p>
            <h3>기록을 아직 불러오지 못했어요</h3>
            <p className="section-copy">{myPageError}</p>
          </div>
          <button type="button" className="primary-button route-submit-button" onClick={() => void onRetry()}>
            다시 불러오기
          </button>
        </section>
      )}
      <section className="sheet-card stack-gap account-action-card">
        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">ACCOUNT</p>
            <h3>계정 관리</h3>
          </div>
        </div>
        <div className="account-action-row">
          <button type="button" className={showSettings ? 'secondary-button is-complete' : 'secondary-button'} onClick={() => setShowSettings((current) => !current)}>
            {showSettings ? '설정 닫기' : '설정 열기'}
          </button>
          <button type="button" className="secondary-button" onClick={() => void onLogout()} disabled={isLoggingOut}>
            {isLoggingOut ? '정리 중' : '로그아웃'}
          </button>
        </div>
      </section>
      {(showSettings || !sessionUser.profileCompletedAt) && (
        <section className="sheet-card stack-gap settings-card">
          <div className="settings-card__header">
            <div>
              <p className="eyebrow">SETTINGS</p>
              <h3>{sessionUser.profileCompletedAt ? '닉네임 수정' : '닉네임을 먼저 정해 주세요'}</h3>
              <p className="section-copy">닉네임은 서비스 전체에서 하나만 사용할 수 있어요.</p>
            </div>
            {sessionUser.profileCompletedAt && (
              <button type="button" className="settings-card__close" onClick={() => setShowSettings(false)} aria-label="설정 닫기">
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
          <form className="route-builder-form" onSubmit={handleNicknameSubmit}>
            <label className="route-builder-field">
              <span>닉네임</span>
              <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="예: 대전산책러" maxLength={40} />
            </label>
            {profileError && <p className="form-error-copy">{profileError}</p>}
            <button type="submit" className="primary-button route-submit-button" disabled={profileSaving || nickname.trim().length < 2}>
              {profileSaving ? '저장 중' : '닉네임 저장'}
            </button>
          </form>
        </section>
      )}

      {myPage && (
        <>
          <section className="sheet-card stack-gap">
            <div className="my-stats-grid">
              <article>
                <strong>{myPage.stats.uniquePlaceCount}/{myPage.stats.totalPlaceCount}</strong>
                <span>방문한 고유 명소</span>
              </article>
              <article>
                <strong>{myPage.stats.stampCount}</strong>
                <span>누적 스탬프 수</span>
              </article>
            </div>
            {myPage.stats.totalPlaceCount > 0 && (
              <div className="my-visit-progress">
                <div className="my-visit-progress__bar">
                  <div className="my-visit-progress__fill" style={{ width: `${visitPct}%` }} />
                </div>
                <span className="my-visit-progress__label">{visitPct}% 달성</span>
              </div>
            )}
            <button type="button" className="secondary-button" onClick={() => setShowVisitedDetail((current) => !current)}>
              {showVisitedDetail ? '방문 상세 닫기' : '방문 상세 보기'}
            </button>
            {showVisitedDetail && (
              <div className="my-visited-grid">
                <div>
                  <div className="my-visited-section-header">
                    <strong>가본 곳</strong>
                    <span className="counter-pill">{myPage.visitedPlaces.length}곳</span>
                  </div>
                  <div className="chip-row compact-gap">
                    {myPage.visitedPlaces.map((place) => (
                      <button key={place.id} type="button" className="soft-tag soft-tag--button" onClick={() => onOpenPlace(place.id)}>
                        {place.name}
                      </button>
                    ))}
                    {myPage.visitedPlaces.length === 0 && <p className="empty-copy">아직 방문한 곳이 없어요.</p>}
                  </div>
                </div>
                <div>
                  <div className="my-visited-section-header">
                    <strong>아직 못 가본 곳</strong>
                    <span className="counter-pill counter-pill--muted">{myPage.unvisitedPlaces.length}곳</span>
                  </div>
                  <div className="chip-row compact-gap">
                    {myPage.unvisitedPlaces.map((place) => (
                      <button key={place.id} type="button" className="soft-tag soft-tag--button is-muted" onClick={() => onOpenPlace(place.id)}>
                        {place.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="sheet-card stack-gap">
            <div className={sessionUser.isAdmin ? 'chip-row compact-gap my-page-primary-tabs my-page-primary-tabs--admin' : 'chip-row compact-gap my-page-primary-tabs'}>
              <button type="button" className={activeTab === 'stamps' ? 'chip is-active' : 'chip'} onClick={() => onChangeTab('stamps')}>
                {'\uC2A4\uD0EC\uD504'}
              </button>
              <button type="button" className={activeTab === 'feeds' ? 'chip is-active' : 'chip'} onClick={() => onChangeTab('feeds')}>
                {'\uD53C\uB4DC'}
              </button>
              <button type="button" className={activeTab === 'comments' ? 'chip is-active' : 'chip'} onClick={() => onChangeTab('comments')}>
                {'\uB313\uAE00'}
              </button>
              <button type="button" className={activeTab === 'routes' ? 'chip is-active' : 'chip'} onClick={() => onChangeTab('routes')}>
                {'\uCF54\uC2A4'}
              </button>
              {sessionUser.isAdmin && (
                <button type="button" className={activeTab === 'admin' ? 'chip is-active' : 'chip'} onClick={() => onChangeTab('admin')}>
                  {'\uAD00\uB9AC'}
                </button>
              )}
            </div>

            {activeTab === 'stamps' && (
              <MyStampTabSection
                stampLogs={myPage.stampLogs}
                travelSessions={myPage.travelSessions}
                onOpenPlace={onOpenPlace}
                onOpenRoutes={() => onChangeTab('routes')}
              />
            )}

            {activeTab === 'feeds' && (
              <MyFeedTabSection
                reviews={myPage.reviews}
                onOpenPlace={onOpenPlace}
                onOpenReview={onOpenReview}
                onUpdateReview={onUpdateReview}
                onDeleteReview={onDeleteReview}
              />
            )}

            {activeTab === 'comments' && (
              <MyCommentsTabSection
                comments={myPage.comments}
                commentsHasMore={commentsHasMore}
                commentsLoadingMore={commentsLoadingMore}
                commentsLoadMoreRef={commentsLoadMoreRef}
                onOpenPlace={onOpenPlace}
                onOpenComment={onOpenComment}
              />
            )}

            {activeTab === 'routes' && (
              <MyRoutesTabSection
                travelSessions={myPage.travelSessions}
                routes={myPage.routes}
                routeSubmitting={routeSubmitting}
                routeError={routeError}
                onOpenPlace={onOpenPlace}
                onOpenRoute={onOpenRoute}
                onPublishRoute={onPublishRoute}
              />
            )}
            {activeTab === 'admin' && sessionUser.isAdmin && (
              <AdminPanel
                summary={adminSummary}
                busyPlaceId={adminBusyPlaceId}
                isImporting={adminLoading}
                onRefreshImport={onRefreshAdmin}
                onTogglePlace={onToggleAdminPlace}
                onToggleManualOverride={onToggleAdminManualOverride}
              />
            )}
          </section>
        </>
      )}
    </section>
  );
}






















