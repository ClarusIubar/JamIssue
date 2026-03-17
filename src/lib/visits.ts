import type { Place, StampLog, TravelSession } from '../types';

const KOREA_TIME_ZONE = 'Asia/Seoul';

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

export function formatDistanceMeters(distanceMeters: number) {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

export function getTodayStampLog(stampLogs: StampLog[], placeId: string) {
  return stampLogs.find((stampLog) => stampLog.placeId === placeId && stampLog.isToday) ?? null;
}

export function getPlaceVisitCount(stampLogs: StampLog[], placeId: string) {
  return stampLogs.filter((stampLog) => stampLog.placeId === placeId).length;
}

export function getLatestPlaceStamp(stampLogs: StampLog[], placeId: string) {
  return stampLogs.find((stampLog) => stampLog.placeId === placeId) ?? null;
}

export function getTravelSessionCoverPlace(places: Place[], session: TravelSession) {
  if (!session.coverPlaceId) {
    return null;
  }

  return places.find((place) => place.id === session.coverPlaceId) ?? null;
}

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
