import { useMemo, useState } from 'react';
import { HeartIcon } from '../review/ReviewActionIcons';
import type { CourseMood, MyPageResponse } from '../../types';

const routeMoodOptions: CourseMood[] = ['데이트', '사진', '힐링', '비 오는 날'];

interface DraftState {
  title: string;
  description: string;
  mood: string;
}

type TravelSession = NonNullable<MyPageResponse>['travelSessions'][number];
type UserRoute = NonNullable<MyPageResponse>['routes'][number];

interface MyRoutesTabSectionProps {
  travelSessions: TravelSession[];
  routes: UserRoute[];
  routeSubmitting: boolean;
  routeError: string | null;
  onOpenPlace: (placeId: string) => void;
  onOpenRoute: (routeId: string) => Promise<void>;
  onPublishRoute: (payload: { travelSessionId: string; title: string; description: string; mood: string }) => Promise<void>;
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

export function MyRoutesTabSection({
  travelSessions,
  routes,
  routeSubmitting,
  routeError,
  onOpenPlace,
  onOpenRoute,
  onPublishRoute,
}: MyRoutesTabSectionProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const unpublishedSessions = useMemo(
    () => travelSessions.filter((session) => session.canPublish && !session.publishedRouteId),
    [travelSessions],
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

  return (
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

      {routeError ? <p className="form-error-copy">{routeError}</p> : null}

      <div className="review-stack">
        {routes.map((route) => (
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
            <div className="review-card__actions review-card__actions--course">
              <button type="button" className="review-link-button" onClick={() => void onOpenRoute(route.id)}>
                코스 탭에서 보기
              </button>
            </div>
          </article>
        ))}
        {routes.length === 0 && <p className="empty-copy">아직 발행한 코스가 없어요.</p>}
      </div>
    </div>
  );
}
