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

export interface PublicEventBannerResponse {
  sourceReady: boolean;
  sourceName: string | null;
  importedAt: string | null;
  items: PublicEventBannerItem[];
}
