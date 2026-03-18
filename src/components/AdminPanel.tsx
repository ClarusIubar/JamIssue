import type { AdminSummaryResponse } from '../types';

interface AdminPanelProps {
  summary: AdminSummaryResponse | null;
  busyPlaceId: string | null;
  isImporting: boolean;
  onRefreshImport: () => Promise<void>;
  onTogglePlace: (placeId: string, nextValue: boolean) => Promise<void>;
}

export function AdminPanel({ summary, busyPlaceId, isImporting, onRefreshImport, onTogglePlace }: AdminPanelProps) {
  if (!summary) {
    return null;
  }

  return (
    <section className="admin-panel card-block">
      <div className="section-title-row">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p className="eyebrow" style={{ margin: 0 }}>ADMIN</p>
          <h3 style={{ margin: 0 }}>운영 대시보드</h3>
        </div>
        <button type="button" className="secondary-button" onClick={() => void onRefreshImport()} disabled={isImporting}>
          {isImporting ? '가져오는 중...' : '공공 데이터 다시 가져오기'}
        </button>
      </div>
      <div className="admin-metrics">
        <article><strong>{summary.userCount}</strong><span>사용자</span></article>
        <article><strong>{summary.placeCount}</strong><span>장소</span></article>
        <article><strong>{summary.reviewCount}</strong><span>후기</span></article>
        <article><strong>{summary.commentCount}</strong><span>댓글</span></article>
      </div>
      <div className="admin-place-list">
        {summary.places.map((place) => (
          <article key={place.id} className="admin-place-item">
            <div>
              <strong>{place.name}</strong>
              <p>{place.district} / 후기 {place.reviewCount}개 / {place.updatedAt}</p>
            </div>
            <button type="button" className={place.isActive ? 'secondary-button is-complete' : 'secondary-button'} onClick={() => void onTogglePlace(place.id, !place.isActive)} disabled={busyPlaceId === place.id}>
              {busyPlaceId === place.id ? '저장 중...' : place.isActive ? '노출 중' : '숨김'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}