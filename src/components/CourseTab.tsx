import { useEffect, useRef } from 'react';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { HeartIcon } from './review/ReviewActionIcons';
import type { CommunityRouteSort, Course, SessionUser, UserRoute } from '../types';

interface CourseTabProps {
  courses: Course[];
  communityRoutes: UserRoute[];
  sort: CommunityRouteSort;
  sessionUser: SessionUser | null;
  routeLikeUpdatingId: string | null;
  highlightedRouteId: string | null;
  placeNameById: Record<string, string>;
  onChangeSort: (sort: CommunityRouteSort) => void;
  onToggleLike: (routeId: string) => Promise<void>;
  onOpenPlace: (placeId: string) => void;
  onOpenRoutePreview: (route: { id: string; title: string; subtitle: string; mood: string; placeIds: string[]; placeNames: string[] }) => void;
  onRequestLogin: () => void;
}

export function CourseTab({
  courses,
  communityRoutes,
  sort,
  sessionUser,
  routeLikeUpdatingId,
  highlightedRouteId,
  placeNameById,
  onChangeSort,
  onToggleLike,
  onOpenPlace,
  onOpenRoutePreview,
  onRequestLogin,
}: CourseTabProps) {
  const scrollRef = useScrollRestoration<HTMLElement>('course');
  const routeRefs = useRef<Record<string, HTMLElement | null>>({});
  void courses;
  void placeNameById;

  useEffect(() => {
    if (!highlightedRouteId) {
      return;
    }
    const target = routeRefs.current[highlightedRouteId];
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedRouteId]);

  return (
    <section ref={scrollRef} className="page-panel page-panel--scrollable">
      <header className="panel-header">
        <p className="eyebrow">COURSE</p>
        <h2>{'\uCF54\uC2A4'}</h2>
        <p>
          스탬프 이력으로 발행된 공개 코스를 훑어보고,
          <br />
          마음에 드는 동선을 다시 따라가 보세요.
        </p>
      </header>

      <section className="sheet-card stack-gap">
        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">USER GENERATED</p>
            <h3>{'\uC88B\uC544\uC694\uC21C\uACFC \uCD5C\uC2E0\uC21C\uC73C\uB85C \uBCF4\uB294 \uACF5\uAC1C \uACBD\uB85C'}</h3>
          </div>
        </div>
        <div className="chip-row compact-gap">
          <button type="button" className={sort === 'popular' ? 'chip is-active' : 'chip'} onClick={() => onChangeSort('popular')}>
            {'\uC88B\uC544\uC694\uC21C'}
          </button>
          <button type="button" className={sort === 'latest' ? 'chip is-active' : 'chip'} onClick={() => onChangeSort('latest')}>
            {'\uCD5C\uC2E0\uC21C'}
          </button>
        </div>
        <div className="community-route-list">
          {communityRoutes.map((route) => (
            <article
              key={route.id}
              ref={(node) => {
                routeRefs.current[route.id] = node;
              }}
              className={route.id === highlightedRouteId ? 'community-route-card community-route-card--highlighted' : 'community-route-card'}
            >
              <div className="community-route-card__header community-route-card__header--feedlike">
                <div className="community-route-card__title-block">
                  <div className="community-route-card__tag-row">
                    <span className="soft-tag">{route.isUserGenerated ? '\uC0AC\uC6A9\uC790 \uACBD\uB85C' : '\uD050\uB808\uC774\uC158'}</span>
                  </div>
                  <h4>{route.title}</h4>
                  <p className="community-route-meta community-route-meta--inline">{route.author} / {route.createdAt}</p>
                </div>
                <button
                  type="button"
                  className={route.likedByMe ? 'review-action-button is-active community-like-button' : 'review-action-button community-like-button'}
                  disabled={routeLikeUpdatingId === route.id}
                  onClick={() => (sessionUser ? onToggleLike(route.id) : onRequestLogin())}
                  aria-pressed={route.likedByMe}
                >
                  <span className="review-action-button__icon" aria-hidden="true"><HeartIcon filled={route.likedByMe} /></span>
                  <span className="review-action-button__label">{route.likeCount}</span>
                </button>
              </div>
              <p>{route.description}</p>
              <div className="course-card__places community-route-places">
                {route.placeIds.map((placeId, index) => (
                  <button key={route.id + '-' + placeId} type="button" className="soft-tag soft-tag--button course-card__place" onClick={() => onOpenPlace(placeId)}>
                    {index + 1}. {route.placeNames[index] ?? placeNameById[placeId] ?? placeId}
                  </button>
                ))}
              </div>
              <div className="review-card__actions review-card__actions--course">
                <button
                  type="button"
                  className="review-link-button"
                  onClick={() => onOpenRoutePreview({
                    id: route.id,
                    title: route.title,
                    subtitle: route.author + ' / ' + route.createdAt,
                    mood: route.mood,
                    placeIds: route.placeIds,
                    placeNames: route.placeNames,
                  })}
                >
                  {'\uC9C0\uB3C4\uC5D0\uC11C \uBCF4\uAE30'}
                </button>
              </div>
            </article>
          ))}
          {communityRoutes.length === 0 && <p className="empty-copy">{'\uC544\uC9C1 \uACF5\uAC1C\uB41C \uC0AC\uC6A9\uC790 \uACBD\uB85C\uAC00 \uC5C6\uC5B4\uC694.'}</p>}
        </div>
      </section>

    </section>
  );
}
