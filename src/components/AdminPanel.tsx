import type { AdminSummaryResponse } from '../types';

/**
 * AdminPanel 컴포넌트가 부모(MyPagePanel)로부터 전달받는 프롭스(Props) 인터페이스입니다.
 * 운영 요약 데이터 및 장소 설정 토글 핸들러를 포함합니다.
 */
interface AdminPanelProps {
  summary: AdminSummaryResponse | null;
  busyPlaceId: string | null;
  isImporting: boolean;
  onRefreshImport: () => Promise<void>;
  onTogglePlace: (placeId: string, nextValue: boolean) => Promise<void>;
  onToggleManualOverride: (placeId: string, nextValue: boolean) => Promise<void>;
}

/**
 * 관리자 권한을 가진 사용자에게만 마이페이지의 한 탭으로 노출되는 관리자 패널 컴포넌트입니다.
 * 앱 전체의 가입자 수, 생성된 피드 및 댓글 개수 등의 통계를 보여주고,
 * 장소 데이터를 수동으로 노출/숨김하거나 공공데이터 동기화 보호를 걸 수 있는 권한을 제공합니다.
 */
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
