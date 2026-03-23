import type { AdminSummaryResponse } from '../types';

interface AdminPanelProps {
  summary: AdminSummaryResponse | null;
  busyPlaceId: string | null;
  isImporting: boolean;
  onRefreshImport: () => Promise<void>;
  onTogglePlace: (placeId: string, nextValue: boolean) => Promise<void>;
  onToggleManualOverride: (placeId: string, nextValue: boolean) => Promise<void>;
}

export function AdminPanel({ summary, busyPlaceId, isImporting, onRefreshImport, onTogglePlace, onToggleManualOverride }: AdminPanelProps) {
  if (!summary) {
    return null;
  }

  return (
    <section className="admin-panel sheet-card stack-gap">
      <div className="section-title-row section-title-row--tight">
        <div>
          <p className="eyebrow">ADMIN</p>
          <h3>운영 요약</h3>
        </div>
        <button type="button" className="secondary-button" onClick={() => void onRefreshImport()} disabled={isImporting}>
          {isImporting ? '불러오는 중' : '행사 다시 불러오기'}
        </button>
      </div>

      <div className="admin-metrics">
        <article><strong>{summary.userCount}</strong><span>사용자</span></article>
        <article><strong>{summary.placeCount}</strong><span>장소</span></article>
        <article><strong>{summary.reviewCount}</strong><span>피드</span></article>
        <article><strong>{summary.commentCount}</strong><span>댓글</span></article>
      </div>

      <div className="admin-place-list">
        {summary.places.map((place) => (
          <article key={place.id} className="admin-place-item">
            <div className="admin-place-item__copy">
              <strong>{place.name}</strong>
              <p>{place.district} / 피드 {place.reviewCount}개 / {place.updatedAt}</p>
            </div>
            <div className="chip-row compact-gap">
              <button
                type="button"
                className={place.isManualOverride ? 'secondary-button is-complete' : 'secondary-button'}
                onClick={() => void onToggleManualOverride(place.id, !place.isManualOverride)}
                disabled={busyPlaceId === place.id}
              >
                {busyPlaceId === place.id ? '적용 중' : place.isManualOverride ? '수동 보호' : '자동 동기화'}
              </button>
              <button
                type="button"
                className={place.isActive ? 'secondary-button is-complete' : 'secondary-button'}
                onClick={() => void onTogglePlace(place.id, !place.isActive)}
                disabled={busyPlaceId === place.id}
              >
                {busyPlaceId === place.id ? '적용 중' : place.isActive ? '노출 중' : '숨김'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
