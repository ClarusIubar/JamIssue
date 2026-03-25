import { useScrollRestoration } from '../hooks/useScrollRestoration';
import type { FestivalItem } from '../types';

interface EventTabProps {
  festivals: FestivalItem[];
}

function formatFestivalPeriod(festival: FestivalItem) {
  if (!festival.startDate && !festival.endDate) {
    return '일정 정보가 아직 없어요.';
  }
  if (festival.startDate === festival.endDate) {
    return festival.startDate;
  }
  return `${festival.startDate} - ${festival.endDate}`;
}

function formatFestivalTitle(title: string) {
  return title
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getFestivalLocationLines(festival: FestivalItem) {
  const venueName = festival.venueName?.trim() || null;
  const roadAddress = festival.roadAddress?.trim() || null;

  if (!venueName && !roadAddress) {
    return ['개최 장소 정보가 아직 없어요.'];
  }

  if (venueName && roadAddress && venueName === roadAddress) {
    return [venueName];
  }

  return [venueName, roadAddress].filter((value): value is string => Boolean(value));
}

export function EventTab({ festivals }: EventTabProps) {
  const scrollRef = useScrollRestoration<HTMLElement>('event');

  return (
    <section ref={scrollRef} className="page-panel page-panel--scrollable">
      <header className="panel-header">
        <p className="eyebrow">EVENT</p>
        <h2>행사</h2>
        <p>대전에서 진행 중이거나 곧 열릴 행사를 한 번에 보고 빠르게 훑어볼 수 있어요.</p>
      </header>

      <section className="sheet-card stack-gap">
        <div className="section-title-row section-title-row--tight">
          <div>
            <p className="eyebrow">DAEJEON FESTIVALS</p>
            <h3>지금 확인할 행사</h3>
          </div>
          <span className="counter-pill">{festivals.length}개</span>
        </div>

        {festivals.length === 0 ? (
          <p className="empty-copy">현재 진행 중이거나 30일 이내 예정된 대전 행사가 없어요.</p>
        ) : (
          <div className="community-route-list festival-card-list">
            {festivals.map((festival) => {
              const locationLines = getFestivalLocationLines(festival);
              return (
                <article key={festival.id} className="community-route-card community-route-card--curated festival-card">
                  <div className="festival-card__top">
                    <div className="festival-card__status-row">
                      {festival.isOngoing ? <span className="soft-tag festival-card__status-chip">진행 중</span> : null}
                      <span className="festival-card__date">{formatFestivalPeriod(festival)}</span>
                    </div>
                    {festival.homepageUrl ? (
                      <a className="festival-card__link" href={festival.homepageUrl} target="_blank" rel="noreferrer">
                        홈페이지 열기
                      </a>
                    ) : null}
                  </div>

                  <div className="festival-card__content">
                    <h4 className="festival-card__title">{formatFestivalTitle(festival.title)}</h4>
                    <div className="festival-card__meta">
                      <div className="festival-card__meta-item">
                        <span className="festival-card__meta-label">장소</span>
                        <div className="festival-card__location">
                          {locationLines.map((line, index) => (
                            <p key={`${festival.id}-${index}`} className={index === 0 ? 'festival-card__location-primary' : 'festival-card__location-secondary'}>
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
