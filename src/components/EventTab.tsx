import { useScrollRestoration } from '../hooks/useScrollRestoration';
import type { FestivalItem } from '../types';

/**
 * EventTab 컴포넌트가 부모(App)로부터 전달받는 프롭스(Props) 인터페이스입니다.
 * 보여줄 축제(행사) 데이터 배열과 선택 액션 핸들러를 포함합니다.
 */
interface EventTabProps {
  festivals: FestivalItem[];
  onOpenFestival: (festivalId: string) => void;
}

/**
 * 시작일과 종료일 데이터를 기반으로 행사 기간을 문자열로 포맷팅합니다.
 * (예: 하루만 진행 시 시작일만 표시, 여러 날 진행 시 '시작일 - 종료일' 표시)
 */
function formatFestivalPeriod(festival: FestivalItem) {
  if (!festival.startDate && !festival.endDate) {
    return '일정 정보가 아직 없어요.';
  }
  if (festival.startDate === festival.endDate) {
    return festival.startDate;
  }
  return `${festival.startDate} - ${festival.endDate}`;
}

/**
 * 공공데이터 기반 행사(축제) 목록을 보여주는 이벤트 탭 컴포넌트입니다.
 * 리스트 아이템을 클릭하면 지도 탭의 해당 행사 마커 위치로 이동합니다.
 */
export function EventTab({ festivals, onOpenFestival }: EventTabProps) {
  const scrollRef = useScrollRestoration<HTMLElement>('event');

  return (
    <section ref={scrollRef} className="page-panel page-panel--scrollable">
      <header className="panel-header">
        <p className="eyebrow">EVENT</p>
        <h2>행사</h2>
        <p>대전에서 진행 중이거나 곧 열릴 행사를 한눈에 보고, 지도에서 바로 위치를 열 수 있어요.</p>
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
          <div className="community-route-list">
            {festivals.map((festival) => (
              <article key={festival.id} className="community-route-card community-route-card--curated">
                <div className="community-route-card__header community-route-card__header--feedlike">
                  <div className="community-route-card__title-block">
                    <div className="community-route-card__tag-row">
                      <span className="soft-tag">{festival.isOngoing ? '진행 중' : '행사 예정'}</span>
                    </div>
                    <h4>{festival.title}</h4>
                    <p className="community-route-meta community-route-meta--inline">{formatFestivalPeriod(festival)}</p>
                  </div>
                </div>

                <div className="stack-gap stack-gap--compact">
                  <p>{festival.venueName || '개최 장소 정보가 아직 없어요.'}</p>
                  <p className="section-copy">{festival.roadAddress || '도로명 주소 정보가 아직 없어요.'}</p>
                </div>

                <div className="review-card__actions review-card__actions--course">
                  <button type="button" className="review-link-button" onClick={() => onOpenFestival(festival.id)}>
                    지도에서 보기
                  </button>
                  {festival.homepageUrl ? (
                    <a className="review-link-button" href={festival.homepageUrl} target="_blank" rel="noreferrer">
                      홈페이지 열기
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
