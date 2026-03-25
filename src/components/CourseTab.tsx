import { useScrollRestoration } from '../hooks/useScrollRestoration';
import type { CommunityRouteSort, Course, SessionUser, UserRoute } from '../types';

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

/**
 * CourseTab 컴포넌트가 부모로부터 전달받는 프롭스(Props) 인터페이스입니다.
 * 공식 큐레이션 코스 배열, 커뮤니티 경로 배열과 이를 조작하기 위한 액션 함수들을 정의합니다.
 */
interface CourseTabProps {
  curatedCourses: Course[];
  communityRoutes: UserRoute[];
  sort: CommunityRouteSort;
  sessionUser: SessionUser | null;
  routeLikeUpdatingId: string | null;
  placeNameById: Record<string, string>;
  onChangeSort: (sort: CommunityRouteSort) => void;
  onToggleLike: (routeId: string) => Promise<void>;
  onOpenPlace: (placeId: string) => void;
  onOpenRoutePreview: (route: { id: string; title: string; subtitle: string; mood: string; placeIds: string[]; placeNames: string[] }) => void;
  onRequestLogin: () => void;
}

/**
 * 코스 탭 화면을 렌더링하는 컴포넌트입니다.
 * 운영자가 큐레이션한 공식 코스(Curated)와 사용자가 직접 만든 코스(Community) 목록을 보여주고
 * 필터/정렬 옵션, 좋아요, 지도에서 미리보기 기능 등을 제공합니다.
 */
export function CourseTab({
  curatedCourses,
  communityRoutes,
  sort,
  sessionUser,
  routeLikeUpdatingId,
  placeNameById,
  onChangeSort,
  onToggleLike,
  onOpenPlace,
  onOpenRoutePreview,
  onRequestLogin,
}: CourseTabProps) {
  const scrollRef = useScrollRestoration<HTMLElement>('course');

  return (
    <section ref={scrollRef} className="page-panel page-panel--scrollable">
      <header className="panel-header">
        <p className="eyebrow">COURSE</p>
        <h2>{'\uCF54\uC2A4'}</h2>
        <p>{'\uCC98\uC74C\uC5D0\uB294 \uAC1C\uBC1C\uC790 \uD050\uB808\uC774\uC158\uC744 \uBCF4\uACE0, \uC774\uD6C4\uC5D0\uB294 \uC2A4\uD0EC\uD504 \uC774\uB825\uC73C\uB85C \uBB36\uC778 \uC0AC\uC6A9\uC790 \uACBD\uB85C\uB97C \uB530\uB77C\uAC00 \uBCF4\uC138\uC694.'}</p>
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
            <article key={route.id} className="community-route-card">
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

      <section className="sheet-card stack-gap">
        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">CURATION</p>
            <h3>{'\uCC98\uC74C \uB458\uB7EC\uBCF4\uAE30 \uC88B\uC740 \uD050\uB808\uC774\uC158 \uCF54\uC2A4'}</h3>
          </div>
          <span className="counter-pill">{curatedCourses.length}{'\uAC1C'}</span>
        </div>
        {curatedCourses.map((course) => (
          <article key={course.id} className="community-route-card community-route-card--curated">
            <div className="community-route-card__header community-route-card__header--feedlike">
              <div className="community-route-card__title-block">
                <div className="community-route-card__tag-row">
                  <span className="soft-tag">{course.mood}</span>
                </div>
                <h4>{course.title}</h4>
                <p className="community-route-meta community-route-meta--inline">{'\uCD94\uCC9C \uCF54\uC2A4'} / {course.duration}</p>
              </div>
            </div>
            <p>{course.note}</p>
            <div className="course-card__places community-route-places">
              {course.placeIds.map((placeId, index) => (
                <button key={course.id + '-' + placeId} type="button" className="soft-tag soft-tag--button course-card__place" onClick={() => onOpenPlace(placeId)}>
                  {index + 1}. {placeNameById[placeId] ?? placeId}
                </button>
              ))}
            </div>
            <div className="review-card__actions review-card__actions--course">
              <button
                type="button"
                className="review-link-button"
                onClick={() => onOpenRoutePreview({
                  id: course.id,
                  title: course.title,
                  subtitle: course.mood + ' / ' + course.duration,
                  mood: course.mood,
                  placeIds: course.placeIds,
                  placeNames: course.placeIds.map((placeId) => placeNameById[placeId] ?? placeId),
                })}
              >
                {'\uC9C0\uB3C4\uC5D0\uC11C \uBCF4\uAE30'}
              </button>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
