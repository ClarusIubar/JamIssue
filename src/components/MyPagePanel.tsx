import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { useAutoLoadMore } from '../hooks/useAutoLoadMore';
import { ProviderButtons } from './ProviderButtons';
import type { AdminSummaryResponse, AuthProvider, CourseMood, MyPageResponse, MyPageTabKey, ReviewMood, SessionUser, TravelSession } from '../types';

interface MyPagePanelProps {
  sessionUser: SessionUser | null;
  myPage: MyPageResponse | null;
  providers: AuthProvider[];
  myPageError: string | null;
  activeTab: MyPageTabKey;
  isLoggingOut: boolean;
  profileSaving: boolean;
  profileError: string | null;
  routeSubmitting: boolean;
  routeError: string | null;
  adminSummary: AdminSummaryResponse | null;
  adminBusyPlaceId: string | null;
  adminLoading: boolean;
  onChangeTab: (nextTab: MyPageTabKey) => void;
  onLogin: (provider: 'naver' | 'kakao') => void;
  onRetry: () => Promise<void>;
  onLogout: () => Promise<void>;
  onSaveNickname: (nickname: string) => Promise<void>;
  onPublishRoute: (payload: { travelSessionId: string; title: string; description: string; mood: string }) => Promise<void>;
  onOpenPlace: (placeId: string) => void;
  onOpenComment: (reviewId: string, commentId: string) => void;
  onOpenReview: (reviewId: string) => void;
  onUpdateReview: (reviewId: string, payload: { body: string; mood: ReviewMood }) => Promise<void>;
  onDeleteReview: (reviewId: string) => Promise<void>;
  onMarkNotificationRead: (notificationId: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onDeleteNotification: (notificationId: string) => Promise<void>;
  commentsHasMore: boolean;
  commentsLoadingMore: boolean;
  onLoadMoreComments: (initial?: boolean) => Promise<void>;
  onRefreshAdmin: () => Promise<void>;
  onToggleAdminPlace: (placeId: string, nextValue: boolean) => Promise<void>;
  onToggleAdminManualOverride: (placeId: string, nextValue: boolean) => Promise<void>;
}

const AdminPanel = lazy(() => import('./AdminPanel').then((module) => ({ default: module.AdminPanel })));

const routeMoodOptions: CourseMood[] = ['데이트', '사진', '힐링', '비 오는 날'];
const reviewMoodOptions: ReviewMood[] = ['혼자서', '친구랑', '데이트', '야경 맛집'];

interface DraftState {
  title: string;
  description: string;
  mood: string;
}

type NotificationItem = NonNullable<MyPageResponse>['notifications'][number];

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="review-action-button__svg" aria-hidden="true">
      <path
        d="M12 21s-6.716-4.309-9.193-8.19C1.25 10.387 2.17 6.9 5.41 5.61c1.98-.788 4.183-.145 5.59 1.495 1.408-1.64 3.611-2.283 5.59-1.495 3.24 1.29 4.16 4.777 2.603 7.2C18.716 16.691 12 21 12 21Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="review-action-button__svg" aria-hidden="true">
      <path
        d="M12 4.75a4.25 4.25 0 0 0-4.25 4.25v2.23c0 .92-.3 1.81-.86 2.54l-1.1 1.47a1 1 0 0 0 .8 1.6h11.82a1 1 0 0 0 .8-1.6l-1.1-1.47a4.24 4.24 0 0 1-.86-2.54V9A4.25 4.25 0 0 0 12 4.75Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.25 18.25a2 2 0 0 0 3.5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

function buildDefaultDraft(session: TravelSession): DraftState {
  const firstPlaceName = session.placeNames[0] ?? '하루 코스';
  const lastPlaceName = session.placeNames[session.placeNames.length - 1] ?? firstPlaceName;
  return {
    title: `${firstPlaceName}에서 ${lastPlaceName}까지`,
    description: `${session.placeNames.join(' - ')} 순서로 24시간 안에 이어진 실제 방문 기록이에요.`,
    mood: '데이트',
  };
}

export function MyPagePanel({
  sessionUser,
  myPage,
  providers,
  myPageError,
  activeTab,
  isLoggingOut,
  profileSaving,
  profileError,
  routeSubmitting,
  routeError,
  adminSummary,
  adminBusyPlaceId,
  adminLoading,
  onChangeTab,
  onLogin,
  onRetry,
  onLogout,
  onSaveNickname,
  onPublishRoute,
  onOpenPlace,
  onOpenComment,
  onOpenReview,
  onUpdateReview,
  onDeleteReview,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDeleteNotification,
  commentsHasMore,
  commentsLoadingMore,
  onLoadMoreComments,
  onRefreshAdmin,
  onToggleAdminPlace,
  onToggleAdminManualOverride,
}: MyPagePanelProps) {
  const [nickname, setNickname] = useState(sessionUser?.nickname ?? '');
  const [showVisitedDetail, setShowVisitedDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingReviewBody, setEditingReviewBody] = useState('');
  const [editingReviewMood, setEditingReviewMood] = useState<ReviewMood>('혼자서');
  const [reviewUpdatingId, setReviewUpdatingId] = useState<string | null>(null);
  const [reviewEditError, setReviewEditError] = useState<string | null>(null);
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

  function startEditingReview(review: NonNullable<MyPageResponse>['reviews'][number]) {
    setEditingReviewId(review.id);
    setEditingReviewBody(review.body);
    setEditingReviewMood(review.mood);
    setReviewEditError(null);
  }

  function cancelEditingReview() {
    setEditingReviewId(null);
    setEditingReviewBody('');
    setEditingReviewMood('혼자서');
    setReviewEditError(null);
  }

  const unpublishedSessions = useMemo(
    () => myPage?.travelSessions.filter((session) => session.canPublish && !session.publishedRouteId) ?? [],
    [myPage],
  );

  const visitPct = useMemo(
    () => (myPage && myPage.stats.totalPlaceCount > 0
      ? Math.round((myPage.stats.uniquePlaceCount / myPage.stats.totalPlaceCount) * 100)
      : 0),
    [myPage],
  );
  const unreadNotificationCount = myPage?.unreadNotificationCount ?? 0;

  function readDraft(session: TravelSession) {
    return drafts[session.id] ?? buildDefaultDraft(session);
  }

  function updateDraft(sessionId: string, patch: Partial<DraftState>, fallbackSession: TravelSession) {
    setDrafts((current) => ({
      ...current,
      [sessionId]: {
        ...buildDefaultDraft(fallbackSession),
        ...(current[sessionId] ?? {}),
        ...patch,
      },
    }));
  }

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
          <p>스탬프를 모으고 피드를 남기고, 하나의 여행 세션을 코스로 발행할 수 있어요.</p>
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
              <div className="review-stack">
                {unpublishedSessions.length > 0 && (
                  <article className="sheet-card stack-gap">
                    <div className="section-title-row section-title-row--tight">
                      <div>
                        <p className="eyebrow">READY TO PUBLISH</p>
                        <h3>{'\uCF54\uC2A4\uB85C \uBC1C\uD589\uD560 \uC218 \uC788\uB294 \uC5EC\uC815\uC774 \uC788\uC5B4\uC694'}</h3>
                      </div>
                      <span className="counter-pill">{unpublishedSessions.length}{'\uAC1C'}</span>
                    </div>
                    <p className="section-copy">{'\u0032\u0034\uC2DC\uAC04 \uC548\uC5D0 \uC774\uC5B4\uC9C4 \uC2A4\uD0EC\uD504 \uAE30\uB85D\uC744 \uACF5\uAC1C \uCF54\uC2A4\uB85C \uBC1C\uD589\uD574 \uBCF4\uC138\uC694.'}</p>
                    <button type="button" className="primary-button route-submit-button" onClick={() => onChangeTab('routes')}>
                      {'\uCF54\uC2A4 \uBC1C\uD589\uD558\uB7EC \uAC00\uAE30'}
                    </button>
                  </article>
                )}
                {myPage.stampLogs.map((stampLog) => (
                  <article key={stampLog.id} className="review-card review-card--stamp-log">
                    <div className="review-card__top review-card__top--feed review-card__top--stamp-log">
                      <div className="review-card__title-block review-card__title-block--feed">
                        <p className="eyebrow">STAMP LOG</p>
                        <strong className="review-card__title">{stampLog.placeName}</strong>
                        <p className="review-card__author-line">{'\uD68D\uB4DD / '}{stampLog.stampedAt}</p>
                      </div>
                      <button type="button" className="review-link-button review-link-button--inline" onClick={() => onOpenPlace(stampLog.placeId)}>{'\uC774 \uC7A5\uC18C \uBCF4\uAE30'}</button>
                    </div>
                    <div className="review-card__tag-row">
                      <span className="review-card__visit-pill">{stampLog.visitLabel}</span>
                      {stampLog.isToday && <span className="soft-tag is-complete">{'\uC624\uB298'}</span>}
                      {stampLog.travelSessionId && stampLog.travelSessionStampCount >= 2 && <span className="soft-tag">{'\uC5EC\uD589 \uC138\uC158 \uC5F0\uACB0'}</span>}
                    </div>
                  </article>
                ))}
                {myPage.stampLogs.length === 0 && <p className="empty-copy">아직 찍은 스탬프가 없어요.</p>}
              </div>
            )}

            {activeTab === 'feeds' && (
              <div className="review-stack">
                {myPage.reviews.map((review) => (
                  <article key={review.id} className="review-card review-card--my-feed">
                    <div className="review-card__top review-card__top--feed">
                      <div className="review-card__title-block review-card__title-block--feed">
                        <p className="eyebrow">{review.mood}</p>
                        <button type="button" className="review-card__place-anchor" onClick={() => onOpenPlace(review.placeId)}><strong className="review-card__title">{review.placeName}</strong></button>
                        <p className="review-card__author-line">{review.visitLabel} · {review.visitedAt}</p>
                      </div>
                    </div>
                    <div className="review-card__tag-row">
                      <span className="review-card__visit-pill">{review.visitLabel}</span>
                      {review.hasPublishedRoute && <span className="soft-tag">연속 여행 기록</span>}
                      <span className="soft-tag">{review.badge}</span>
                    </div>
                    {editingReviewId === review.id ? (
                      <div className="route-builder-form review-edit-form">
                        <div className="chip-row compact-gap">
                          {reviewMoodOptions.map((mood) => (
                            <button
                              key={review.id + '-' + mood}
                              type="button"
                              className={editingReviewMood === mood ? 'chip is-active' : 'chip'}
                              onClick={() => setEditingReviewMood(mood)}
                              disabled={reviewUpdatingId === review.id}
                            >
                              {mood}
                            </button>
                          ))}
                        </div>
                        <label className="route-builder-field">
                          <span>피드 내용</span>
                          <textarea
                            rows={4}
                            value={editingReviewBody}
                            onChange={(event) => setEditingReviewBody(event.target.value)}
                            disabled={reviewUpdatingId === review.id}
                          />
                        </label>
                        {reviewEditError ? <p className="form-error-copy">{reviewEditError}</p> : null}
                        <div className="review-card__actions review-card__actions--my-feed">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={cancelEditingReview}
                            disabled={reviewUpdatingId === review.id}
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={reviewUpdatingId === review.id || editingReviewBody.trim().length < 4}
                            onClick={() => {
                              setReviewUpdatingId(review.id);
                              setReviewEditError(null);
                              void onUpdateReview(review.id, {
                                body: editingReviewBody.trim(),
                                mood: editingReviewMood,
                              })
                                .then(() => {
                                  cancelEditingReview();
                                })
                                .catch((error) => {
                                  setReviewEditError(error instanceof Error ? error.message : '피드를 수정하지 못했어요.');
                                })
                                .finally(() => {
                                  setReviewUpdatingId(null);
                                });
                            }}
                          >
                            {reviewUpdatingId === review.id ? '저장 중' : '수정 저장'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="review-card__body">{review.body}</p>
                        <div className="review-card__actions review-card__actions--my-feed">
                          <button type="button" className="review-card__place-link" onClick={() => onOpenReview(review.id)}>내 피드 보기</button>
                          <button type="button" className="review-card__place-link" onClick={() => startEditingReview(review)}>수정</button>
                          <button type="button" className="review-card__place-link review-card__place-link--danger" onClick={() => void onDeleteReview(review.id)}>삭제</button>
                        </div>
                      </>
                    )}
                  </article>
                ))}
                {myPage.reviews.length === 0 && <p className="empty-copy">아직 작성한 피드가 없어요.</p>}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="review-stack">
                {myPage.comments.map((comment) => (
                  <article key={comment.id} className="review-card review-card--comment-log">
                    <div className="review-card__top review-card__top--comment-log">
                      <div className="review-card__title-block review-card__title-block--comment-log">
                        <p className="review-card__label review-card__label--comment-log">내 댓글</p>
                        <p className="review-card__body review-card__body--comment-log">{comment.body}</p>
                        <p className="review-card__meta-line">{comment.parentId ? '답글 남김' : '댓글 남김'} · {comment.createdAt}</p>
                        <button type="button" className="review-card__place-anchor" onClick={() => onOpenPlace(comment.placeId)}>
                          <strong>{comment.placeName}</strong>
                        </button>
                      </div>
                    </div>
                    <p className="review-card__context-line">피드 원문 · {comment.reviewBody}</p>
                    <button type="button" className="review-card__place-link" onClick={() => onOpenComment(comment.reviewId, comment.id)}>
                      내 댓글 보기
                    </button>
                  </article>
                ))}
                {myPage.comments.length === 0 && <p className="empty-copy">아직 작성한 댓글이 없어요.</p>}
              </div>
            )}

            {activeTab === 'routes' && (
              <div className="stack-gap">
                <div className="review-stack">
                  {unpublishedSessions.map((session) => {
                    const draft = readDraft(session);
                    return (
                      <article key={session.id} className="community-route-card community-route-card--draft">
                        <div className="community-route-card__header">
                          <div>
                            <p className="eyebrow">TRAVEL SESSION</p>
                            <h4>{session.durationLabel}</h4>
                          </div>
                          <span className="counter-pill">스탬프 {session.stampCount}개</span>
                        </div>
                        <div className="course-card__places community-route-places">
                          {session.placeIds.map((placeId, index) => (
                            <button key={`${session.id}-${placeId}`} type="button" className="soft-tag soft-tag--button course-card__place" onClick={() => onOpenPlace(placeId)}>
                              {index + 1}. {session.placeNames[index] ?? placeId}
                            </button>
                          ))}
                        </div>
                        <div className="route-builder-form">
                          <label className="route-builder-field">
                            <span>코스 제목</span>
                            <input value={draft.title} onChange={(event) => updateDraft(session.id, { title: event.target.value }, session)} />
                          </label>
                          <label className="route-builder-field">
                            <span>한 줄 설명</span>
                            <textarea rows={3} value={draft.description} onChange={(event) => updateDraft(session.id, { description: event.target.value }, session)} />
                          </label>
                          <div className="chip-row compact-gap">
                            {routeMoodOptions.map((mood) => (
                              <button key={mood} type="button" className={draft.mood === mood ? 'chip is-active' : 'chip'} onClick={() => updateDraft(session.id, { mood }, session)}>
                                {mood}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="primary-button route-submit-button"
                            disabled={routeSubmitting || draft.title.trim().length < 2 || draft.description.trim().length < 8}
                            onClick={() =>
                              void onPublishRoute({
                                travelSessionId: session.id,
                                title: draft.title.trim(),
                                description: draft.description.trim(),
                                mood: draft.mood,
                              })
                            }
                          >
                            {routeSubmitting ? '발행 중' : '코스로 발행'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {unpublishedSessions.length === 0 && <p className="empty-copy">아직 코스로 묶을 수 있는 여행 세션이 없어요.</p>}
                </div>

                {routeError && <p className="form-error-copy">{routeError}</p>}

                <div className="review-stack">
                  {myPage.routes.map((route) => (
                    <article key={route.id} className="community-route-card community-route-card--my">
                      <div className="community-route-card__header community-route-card__header--feedlike">
                        <div className="community-route-card__title-block">
                          <div className="community-route-card__tag-row">
                            <span className="soft-tag">발행 완료</span>
                          </div>
                          <h4>{route.title}</h4>
                          <p className="community-route-meta community-route-meta--inline">{route.createdAt}</p>
                        </div>
                        <span className="review-action-button review-action-button--static community-like-button" aria-hidden="true">
                          <span className="review-action-button__icon"><HeartIcon filled={true} /></span>
                          <span className="review-action-button__label">{route.likeCount}</span>
                        </span>
                      </div>
                      <p>{route.description}</p>
                      <div className="course-card__places community-route-places">
                        {route.placeIds.map((placeId, index) => (
                          <button key={`${route.id}-${placeId}`} type="button" className="soft-tag soft-tag--button course-card__place" onClick={() => onOpenPlace(placeId)}>
                            {index + 1}. {route.placeNames[index] ?? placeId}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                  {myPage.routes.length === 0 && <p className="empty-copy">아직 발행한 코스가 없어요.</p>}
                </div>
              </div>
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






















