import type { CommunityRouteSort, SessionUser, UserRoute } from '../types';

interface CommunityRouteSectionProps {
  routes: UserRoute[];
  sort: CommunityRouteSort;
  sessionUser: SessionUser | null;
  likingRouteId: string | null;
  onChangeSort: (sort: CommunityRouteSort) => void;
  onToggleLike: (routeId: string) => Promise<void>;
  onOpenPlace: (placeId: string) => void;
}

const sortLabels: Array<{ key: CommunityRouteSort; label: string }> = [
  { key: 'popular', label: '좋아요순' },
  { key: 'latest', label: '최신순' },
];

export function CommunityRouteSection({ routes, sort, sessionUser, likingRouteId, onChangeSort, onToggleLike, onOpenPlace }: CommunityRouteSectionProps) {
  return (
    <section className="card-block community-route-block">
      <div className="section-title-row section-title-row--tight">
        <div>
          <p className="eyebrow">COMMUNITY TOAST</p>
          <h3>오늘의 토스트를 만드는 새로운 방법</h3>
          <p className="section-copy">다른 여행자들이 어떤 토스트(스탬프 모음)를 만들었는지 확인해보세요.</p>
        </div>
      </div>

      <div className="community-route-sort-row">
        {sortLabels.map((item) => (
          <button key={item.key} type="button" className={item.key === sort ? 'chip is-active' : 'chip'} onClick={() => onChangeSort(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="community-route-list">
        {routes.map((route) => {
          const isOwnRoute = route.authorId === sessionUser?.id;
          const isBusy = likingRouteId === route.id;
          return (
            <article key={route.id} className="community-route-card">
              <div className="community-route-card__header">
                <div>
                  <p className="eyebrow">{route.mood} 무드</p>
                  <h4>{route.title}</h4>
                </div>
                <button
                  type="button"
                  className={route.likedByMe ? 'secondary-button community-like-button is-complete' : 'secondary-button community-like-button'}
                  onClick={() => void onToggleLike(route.id)}
                  disabled={!sessionUser || isOwnRoute || isBusy}
                >
                  {isBusy ? '반영 중' : `좋아요 ${route.likeCount}`}
                </button>
              </div>
              <p>{route.description}</p>
              <div className="community-route-meta" style={{ display: 'flex', gap: '8px', marginBottom: '8px', color: 'var(--muted)', fontSize: '12px' }}>
                <span>작성자: {route.author}님</span>
                <span>•</span>
                <span>{route.createdAt}</span>
              </div>
              <div className="course-card__places community-route-places">
                {route.placeIds.map((placeId, index) => (
                  <button key={`${route.id}-${placeId}`} type="button" className="soft-tag soft-tag--button course-card__place" onClick={() => onOpenPlace(placeId)}>
                    {index + 1}. {route.placeNames[index] ?? placeId}
                  </button>
                ))}
              </div>
              {isOwnRoute && <p className="helper-copy">내가 만든 경로는 좋아요를 직접 누를 수 없어요.</p>}
              {!sessionUser && <p className="helper-copy">로그인하면 좋아요로 유저 경로를 올려줄 수 있어요.</p>}
            </article>
          );
        })}
        {routes.length === 0 && <p className="empty-copy">아직 공개된 토스트 모음집이 없어요. 첫 번째 모음집을 공개해 보세요.</p>}
      </div>
    </section>
  );
}
