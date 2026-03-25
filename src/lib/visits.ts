import type { Place, StampLog, TravelSession } from '../types';

const KOREA_TIME_ZONE = 'Asia/Seoul';

/**
 * Haversine 공식을 사용하여, 지구 위 두 지점 사이의 최단 직선 거리를 미터(meters) 단위로 계산합니다.
 * 지도 내 현재 위치에서 마커 간 거리나 스탬프 적립 조건(반경) 확인 시 사용됩니다.
 */
export function calculateDistanceMeters(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = ((endLatitude - startLatitude) * Math.PI) / 180;
  const longitudeDelta = ((endLongitude - startLongitude) * Math.PI) / 180;
  const startLatitudeRadians = (startLatitude * Math.PI) / 180;
  const endLatitudeRadians = (endLatitude * Math.PI) / 180;

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) * Math.cos(endLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * (2 * Math.asin(Math.sqrt(haversine)));
}

/**
 * 거리를 미터(m) 또는 킬로미터(km) 형식의 문자열로 변환하여 반환합니다.
 * 1000m 미만은 m로 표시하고, 이상은 소수점 한 자리의 km로 표시합니다.
 */
export function formatDistanceMeters(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

/**
 * 주어진 장소(placeId)에 대해, 오늘 스탬프를 찍은 기록이 있는지 확인하고 찾아 반환합니다.
 * 없으면 null을 반환합니다. 스탬프 중복 적립을 방지하거나 리뷰 작성 가능 여부를 판단할 때 쓰입니다.
 */
export function getTodayStampLog(stampLogs: StampLog[], placeId: string) {
  return stampLogs.find((stampLog) => stampLog.placeId === placeId && stampLog.isToday) ?? null;
}

/**
 * 사용자의 전체 스탬프 기록 중에서, 특정 장소에 몇 번 스탬프를 찍었는지(누적 방문 횟수) 계산합니다.
 */
export function getPlaceVisitCount(stampLogs: StampLog[], placeId: string) {
  return stampLogs.filter((stampLog) => stampLog.placeId === placeId).length;
}

/**
 * 특정 장소에 대해 사용자가 찍은 가장 최근의 스탬프 기록 하나를 찾아서 반환합니다.
 * (stampLogs 배열이 최신순으로 정렬되어 있다고 가정합니다.)
 */
export function getLatestPlaceStamp(stampLogs: StampLog[], placeId: string) {
  return stampLogs.find((stampLog) => stampLog.placeId === placeId) ?? null;
}

/**
 * 사용자의 여행 세션(TravelSession)을 시각적으로 표현할 때 사용할 커버 이미지(장소)를 찾습니다.
 * 세션 내 여러 장소 중 대표(coverPlaceId) 장소 객체를 반환합니다.
 */
export function getTravelSessionCoverPlace(places: Place[], session: TravelSession) {
  if (!session.coverPlaceId) {
    return null;
  }

  return places.find((place) => place.id === session.coverPlaceId) ?? null;
}

/**
 * 세션의 시작/종료 일시를 받아 "12월 05일 14:00 - 12월 06일 10:00" 같은 요약 문자열 라벨로 포맷팅합니다.
 * 한국 시간(Asia/Seoul) 기준의 Intl.DateTimeFormat을 사용합니다.
 */
export function formatTripWindowLabel(startedAt: string, endedAt: string) {
  const formatter = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: KOREA_TIME_ZONE,
  });

  const startDate = new Date(startedAt);
  const endDate = new Date(endedAt);
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}
