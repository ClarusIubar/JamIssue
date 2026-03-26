import type { DrawerState, FestivalItem } from '../types';

interface FestivalDetailSheetProps {
  festival: FestivalItem | null;
  isOpen: boolean;
  drawerState: DrawerState;
  onClose: () => void;
  onExpand: () => void;
  onCollapse: () => void;
}

function formatFestivalTitle(title: string) {
  return title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[&_·•/|]+/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+[A-Z][A-Z0-9-]{2,}$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function FestivalDetailSheet({
  festival,
  isOpen,
  drawerState,
  onClose,
  onExpand,
  onCollapse,
}: FestivalDetailSheetProps) {
  if (!festival || !isOpen) {
    return null;
  }

  const sheetClassName = `place-drawer place-drawer--${drawerState}`;
  const hasSchedule = Boolean(festival.startDate || festival.endDate);
  const periodLabel = hasSchedule
    ? festival.startDate && festival.endDate
      ? `${festival.startDate} ~ ${festival.endDate}`
      : festival.startDate || festival.endDate
    : '일정 업데이트 전';

  return (
    <section className={sheetClassName} aria-label="행사 상세 서랍">
      <button
        type="button"
        className="place-drawer__handle"
        aria-label="서랍 높이 조절"
        onClick={drawerState === 'partial' ? onExpand : onCollapse}
      >
        <span />
      </button>

      <div className="place-drawer__content">
        <div className="place-drawer__header">
          <div>
            <p className="eyebrow">FESTIVAL</p>
            <h2>{formatFestivalTitle(festival.title)}</h2>
            <p className="place-drawer__summary">{festival.venueName || festival.roadAddress || '대전 곳곳에서 열리는 행사 정보예요.'}</p>
          </div>
          <button type="button" className="text-button" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="place-drawer__badges">
          {festival.isOngoing ? <span className="counter-pill">진행 중</span> : null}
          <span className="counter-pill">{periodLabel}</span>
        </div>

        <div className="sheet-card stack-gap">
          <div>
            <strong>개최 장소</strong>
            <p>{festival.venueName || '공개된 개최 장소 정보가 없어요.'}</p>
          </div>
          <div>
            <strong>주소</strong>
            <p>{festival.roadAddress || '도로명 주소 정보가 없어요.'}</p>
          </div>
          <div>
            <strong>행사 기간</strong>
            <p>{periodLabel}</p>
          </div>
        </div>

        <div className="sheet-card stack-gap">
          <div>
            <strong>공식 홈페이지</strong>
            <p>{festival.homepageUrl ? '홈페이지에서 세부 일정을 바로 확인할 수 있어요.' : '공식 홈페이지 주소가 아직 제공되지 않았어요.'}</p>
          </div>
          {festival.homepageUrl ? (
            <a className="primary-button primary-button--block" href={festival.homepageUrl} target="_blank" rel="noreferrer">
              홈페이지 열기
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
