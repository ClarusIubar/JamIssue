import { useEffect, useMemo, useState } from 'react';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { ProviderButtons } from './ProviderButtons';
import type { AuthProvider, CourseMood, MyPageResponse, MyPageTabKey, SessionUser, TravelSession } from '../types';

interface MyPagePanelProps {
  sessionUser: SessionUser | null;
  myPage: MyPageResponse | null;
  providers: AuthProvider[];
  activeTab: MyPageTabKey;
  isLoggingOut: boolean;
  profileSaving: boolean;
  profileError: string | null;
  routeSubmitting: boolean;
  routeError: string | null;
  onChangeTab: (nextTab: MyPageTabKey) => void;
  onLogin: (provider: 'naver' | 'kakao') => void;
  onLogout: () => Promise<void>;
  onSaveNickname: (nickname: string) => Promise<void>;
  onPublishRoute: (payload: { travelSessionId: string; title: string; description: string; mood: string }) => Promise<void>;
  onOpenPlace: (placeId: string) => void;
  onOpenComment: (reviewId: string, commentId: string) => void;
}

const routeMoodOptions: CourseMood[] = ['데이트', '사진', '힐링', '비 오는 날'];

interface DraftState {
  title: string;
  description: string;
  mood: string;
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
  activeTab,
  isLoggingOut,
  profileSaving,
  profileError,
  routeSubmitting,
  routeError,
  onChangeTab,
  onLogin,
  onLogout,
  onSaveNickname,
  onPublishRoute,
  onOpenPlace,
  onOpenComment,
}: MyPagePanelProps) {
  const [nickname, setNickname] = useState(sessionUser?.nickname ?? '');
  const [showVisitedDetail, setShowVisitedDetail] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const scrollRef = useScrollRestoration<HTMLElement>(`my:${activeTab}`);

  useEffect(() => {
    setNickname(sessionUser?.nickname ?? '');
    if (sessionUser && !sessionUser.profileCompletedAt) {
      setShowSettings(true);
    }
  }, [sessionUser?.nickname, sessionUser?.profileCompletedAt]);

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
        <div className="panel-header__actions">
          <button
            type="button"
            className={showSettings ? 'secondary-button icon-button is-complete' : 'secondary-button icon-button'}
            onClick={() => setShowSettings((current) => !current)}
            aria-label="설정 열기"
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <button type="button" className="secondary-button" onClick={() => void onLogout()} disabled={isLoggingOut}>
            {isLoggingOut ? '정리 중' : '로그아웃'}
          </button>
        </div>
      </header>

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
            <div className="chip-row compact-gap my-page-primary-tabs">
              <button type="button" className={activeTab === 'stamps' ? 'chip is-active' : 'chip'} onClick={() => onChangeTab('stamps')}>
                얻은 스탬프
              </button>
              <button type="button" className={activeTab === 'feeds' ? 'chip is-active' : 'chip'} onClick={() => onChangeTab('feeds')}>
                내가 쓴 피드
              </button>
              <button type="button" className={activeTab === 'comments' ? 'chip is-active' : 'chip'} onClick={() => onChangeTab('comments')}>
                내가 쓴 댓글
              </button>
              <button type="button" className={activeTab === 'routes' ? 'chip is-active' : 'chip'} onClick={() => onChangeTab('routes')}>
                생성한 코스
              </button>
            </div>

            {activeTab === 'stamps' && (
              <div className="review-stack">
                {myPage.stampLogs.map((stampLog) => (
                  <article key={stampLog.id} className="review-card review-card--stamp-log">
                    <div className="review-card__top">
                      <div>
                        <strong>{stampLog.placeName}</strong>
                        <p>{stampLog.isToday ? '오늘 찍은 스탬프' : '방문 스탬프 기록'}</p>
                      </div>
                      <span className="counter-pill">{stampLog.visitLabel}</span>
                    </div>
                    <div className="chip-row compact-gap review-card__meta-wrap">
                      <span className="soft-tag">획득 {stampLog.stampedAt}</span>
                      {stampLog.isToday && <span className="soft-tag is-complete">오늘</span>}
                      {stampLog.travelSessionId && <span className="soft-tag">여행 세션 연결</span>}
                    </div>
                    <button type="button" className="text-button review-card__place-link" onClick={() => onOpenPlace(stampLog.placeId)}>
                      장소 열기
                    </button>
                  </article>
                ))}
                {myPage.stampLogs.length === 0 && <p className="empty-copy">아직 찍은 스탬프가 없어요.</p>}
              </div>
            )}

            {activeTab === 'feeds' && (
              <div className="review-stack">
                {myPage.reviews.map((review) => (
                  <article key={review.id} className="review-card">
                    <div className="review-card__top">
                      <div>
                        <strong>{review.placeName}</strong>
                        <p>{review.visitLabel} · {review.visitedAt}</p>
                      </div>
                      <span className="mood-pill">{review.mood}</span>
                    </div>
                    <p className="review-card__body">{review.body}</p>
                    <button type="button" className="text-button review-card__place-link" onClick={() => onOpenPlace(review.placeId)}>
                      장소 열기
                    </button>
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
                      <div className="review-card__title-block">
                        <button type="button" className="review-card__place-anchor" onClick={() => onOpenPlace(comment.placeId)}>
                          <strong>{comment.placeName}</strong>
                        </button>
                        <p className="review-card__meta-line">{comment.parentId ? '답글 남김' : '댓글 남김'} · {comment.createdAt}</p>
                      </div>
                      <span className="counter-pill">{comment.isDeleted ? '삭제됨' : '작성됨'}</span>
                    </div>
                    <div className="review-card__content-stack">
                      <div className="review-card__quote-block">
                        <p className="review-card__label">내 댓글</p>
                        <p className="review-card__body">{comment.body}</p>
                      </div>
                      <div className="review-card__quote-block review-card__quote-block--muted">
                        <p className="review-card__label">피드 원문</p>
                        <p className="section-copy">{comment.reviewBody}</p>
                      </div>
                    </div>
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
                      <div className="community-route-card__header">
                        <div>
                          <p className="eyebrow">PUBLISHED</p>
                          <h4>{route.title}</h4>
                        </div>
                        <span className="counter-pill">좋아요 {route.likeCount}</span>
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
          </section>
        </>
      )}
    </section>
  );
}









