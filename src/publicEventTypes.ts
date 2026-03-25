/**
 * 홈 배너 화면에서 보여줄 단일 공공 행사(축제 등)의 데이터를 나타내는 모델입니다.
 */
export interface PublicEventBannerItem {
  id: string;
  title: string;
  venueName: string | null;
  district: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  summary: string;
  sourcePageUrl: string | null;
  linkedPlaceName: string | null;
  isOngoing: boolean;
}

/**
 * 공공 행사 배너 목록의 전체 응답(Response) 모델입니다.
 * 데이터 출처의 상태 메타데이터와 행사 아이템 배열을 포함합니다.
 */
export interface PublicEventBannerResponse {
  sourceReady: boolean;
  sourceName: string | null;
  importedAt: string | null;
  items: PublicEventBannerItem[];
}
