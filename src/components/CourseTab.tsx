import type { CommunityRouteSort, Course, SessionUser, UserRoute } from '../types';

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
  onRequestLogin: () => void;
}

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
  onRequestLogin,
}: CourseTabProps) {
  return (
    <section className="tab-overlay tab-overlay--scrollable">
      <header className="panel-header">
        <p className="eyebrow">COURSE</p>
        <h2>코스</h2>
        <p>처음에는 개발자 큐레이션을 보고, 이후에는 스탬프 이력으로 묶인 사용자 경로를 따라가 보세요.</p>
      </header>

      <section className="sheet-card stack-gap">
        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">USER GENERATED</p>
            <h3>좋아요순과 최신순으로 보는 공개 경로</h3>
          </div>
        </div>
        <div className="chip-row compact-gap">
          <button type="button" className={sort === 'popular' ? 'chip is-active' : 'chip'} onClick={() => onChangeSort('popular')}>
            좋아요순
          </button>
          <button type="button" className={sort === 'latest' ? 'chip is-active' : 'chip'} onClick={() => onChangeSort('latest')}>
            최신순
          </button>
        </div>
        <div className="community-route-list">
          {communityRoutes.map((route) => (
            <article key={route.id} className="community-route-card">
              <div className="community-route-card__header">
                <div>
                  <p className="eyebrow">{route.isUserGenerated ? 'USER ROUTE' : 'CURATED ROUTE'}</p>
                  <h4>{route.title}</h4>
                </div>
                <button
                  type="button"
                  className={route.likedByMe ? 'secondary-button community-like-button is-complete' : 'secondary-button community-like-button'}
                  disabled={routeLikeUpdatingId === route.id}
                  onClick={() => (sessionUser ? onToggleLike(route.id) : onRequestLogin())}
                >
                  {routeLikeUpdatingId === route.id ? '반영 중' : `좋아요 ${route.likeCount}`}
                </button>
              </div>
              <p>{route.description}</p>
              <div className="community-route-meta">
                <span>{route.author}</span>
                <span>{route.createdAt}</span>
              </div>
              <div className="course-card__places community-route-places">
                {route.placeIds.map((placeId, index) => (
                  <button key={`${route.id}-${placeId}`} type="button" className="soft-tag soft-tag--button course-card__place" onClick={() => onOpenPlace(placeId)}>
                    {index + 1}. {route.placeNames[index] ?? placeNameById[placeId] ?? placeId}
                  </button>
                ))}
              </div>
            </article>
          ))}
          {communityRoutes.length === 0 && <p className="empty-copy">아직 공개된 사용자 경로가 없어요.</p>}
        </div>
      </section>

      <section className="sheet-card stack-gap">
        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">CURATION</p>
            <h3>처음 둘러보기 좋은 큐레이션 코스</h3>
          </div>
          <span className="counter-pill">{curatedCourses.length}개</span>
        </div>
        {curatedCourses.map((course) => (
          <article key={course.id} className="community-route-card community-route-card--curated">
            <div className="community-route-card__header">
              <div>
                <p className="eyebrow">{course.mood}</p>
                <h4>{course.title}</h4>
              </div>
              <span className="counter-pill">{course.duration}</span>
            </div>
            <p>{course.note}</p>
            <div className="course-card__places community-route-places">
              {course.placeIds.map((placeId, index) => (
                <button key={`${course.id}-${placeId}`} type="button" className="soft-tag soft-tag--button course-card__place" onClick={() => onOpenPlace(placeId)}>
                  {index + 1}. {placeNameById[placeId] ?? placeId}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
