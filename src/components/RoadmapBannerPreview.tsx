import { useEffect, useState, type CSSProperties } from 'react';
import { getPublicEventBanner } from '../api/client';
import type { PublicEventBannerResponse } from '../publicEventTypes';

const INITIAL_DATA: PublicEventBannerResponse = {
  sourceReady: false,
  sourceName: null,
  importedAt: null,
  items: [],
};

export function RoadmapBannerPreview() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<PublicEventBannerResponse>(INITIAL_DATA);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function loadBanner() {
      try {
        const response = await getPublicEventBanner();
        if (!active) {
          return;
        }
        setData(response);
        setStatus('ready');
      } catch (error) {
        if (!active) {
          return;
        }
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : '행사 일정을 불러오지 못했어요.');
      }
    }

    void loadBanner();
    return () => {
      active = false;
    };
  }, []);

  const summaryItems = [
    { label: '현재 일정', value: `${data.items.length}건`, tone: 'pink' as const },
    { label: '데이터 출처', value: data.sourceName ?? '미연결', tone: 'blue' as const },
    { label: '가져온 시각', value: data.importedAt ?? '아직 없음', tone: 'mint' as const },
  ];

  return (
    <div className="app-shell preview-shell">
      <main className="phone-shell roadmap-shell">
        <section className="roadmap-hero sheet-card">
          <p className="eyebrow">PUBLIC EVENT BANNER</p>
          <h1>대전 행사 일정 배너</h1>
          <p className="roadmap-hero__subtitle">공공 행사 API에서 가져온 일정만 카드로 보여주는 프리뷰입니다.</p>

          <div className="roadmap-summary">
            {summaryItems.map((item) => (
              <article key={item.label} className={`roadmap-summary__item roadmap-summary__item--${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>

          <div className="roadmap-hero__timeline">
            {data.items.slice(0, 4).map((item) => (
              <span key={item.id} className="roadmap-hero__timeline-chip">
                {item.dateLabel} · {item.title}
              </span>
            ))}
          </div>

          <p className="roadmap-hero__helper">
            {data.sourceReady
              ? '행사 API가 연결되어 있으면 최신 일정만 여기로 들어옵니다.'
              : '행사 API URL이 아직 연결되지 않았어요. 연결되면 이 배너가 실제 일정으로 채워집니다.'}
          </p>
        </section>

        <section className="roadmap-section sheet-card">
          <div className="section-title-row section-title-row--tight roadmap-section__header">
            <div>
              <p className="eyebrow">LIVE SCHEDULE</p>
              <h2>실제 행사 일정 카드</h2>
            </div>
            <span className="counter-pill">{data.items.length} cards</span>
          </div>

          {status === 'loading' ? (
            <article className="roadmap-empty">
              <strong>행사 일정을 불러오는 중이에요.</strong>
              <p>실제 API가 연결되어 있으면 최신 일정이 카드로 채워집니다.</p>
            </article>
          ) : null}

          {status === 'error' ? (
            <article className="roadmap-empty roadmap-empty--error">
              <strong>행사 일정을 아직 읽지 못했어요.</strong>
              <p>{errorMessage}</p>
            </article>
          ) : null}

          {status === 'ready' && data.items.length === 0 ? (
            <article className="roadmap-empty">
              <strong>현재 보여줄 행사 일정이 없어요.</strong>
              <p>행사 API URL이나 JSON을 연결하면 일정 카드가 여기에 들어옵니다.</p>
            </article>
          ) : null}

          <div className="roadmap-grid">
            {data.items.map((item) => (
              <article
                key={item.id}
                className="roadmap-card"
                style={{ '--roadmap-accent': item.isOngoing ? '#ff8fb7' : '#8ecbff' } as CSSProperties}
              >
                <div className="roadmap-card__topline">
                  <span className={`roadmap-card__badge ${item.isOngoing ? 'roadmap-card__badge--pink' : 'roadmap-card__badge--blue'}`}>
                    {item.isOngoing ? '진행 중' : item.dateLabel}
                  </span>
                  <strong>{item.district}</strong>
                </div>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <p className="roadmap-card__deliverable">
                  <span>행사 일정</span>
                  <strong>{item.dateLabel}</strong>
                </p>
                <div className="roadmap-card__meta">
                  <span>{item.venueName ?? '장소 정보 없음'}</span>
                  {item.linkedPlaceName ? <span>연결 장소 · {item.linkedPlaceName}</span> : null}
                </div>
                {item.sourcePageUrl ? (
                  <a className="roadmap-card__link" href={item.sourcePageUrl} target="_blank" rel="noreferrer">
                    원본 페이지 보기
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}