import { calculateDistanceMeters, formatDistanceMeters } from './visits';

/**
 * 사용자 디바이스의 측정된 위치 좌표 및 정확도 정보를 담는 인터페이스입니다.
 */
export interface CurrentDeviceLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

const DAEJEON_CENTER = { latitude: 36.3504, longitude: 127.3845 };
const DAEJEON_VALID_RADIUS_METERS = 45_000;
const MAX_ACCEPTABLE_LOCATION_ACCURACY_METERS = 5_000;
const EARLY_SUCCESS_LOCATION_ACCURACY_METERS = 150;

/**
 * 브라우저 Geolocation API가 측정한 위치 객체가 요구하는 기준(오차 범위, 대전 지역 내 여부)을 만족하는지 검증합니다.
 * 조건에 맞지 않으면 오류(Error)를 발생시킵니다.
 */
function validateCurrentDevicePosition(position: GeolocationPosition): CurrentDeviceLocation {
  const nextPosition = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: Math.round(position.coords.accuracy ?? 0),
  };

  const distanceFromDaejeon = calculateDistanceMeters(
    DAEJEON_CENTER.latitude,
    DAEJEON_CENTER.longitude,
    nextPosition.latitude,
    nextPosition.longitude,
  );

  if (distanceFromDaejeon > DAEJEON_VALID_RADIUS_METERS) {
    throw new Error('현재 위치가 대전 반경 밖으로 잡혔어요. 위치 서비스나 Wi-Fi를 켠 뒤 다시 확인해 주세요.');
  }

  if (nextPosition.accuracyMeters > MAX_ACCEPTABLE_LOCATION_ACCURACY_METERS) {
    throw new Error(`현재 위치 정확도가 약 ${formatDistanceMeters(nextPosition.accuracyMeters)}로 너무 넓어요. 위치를 다시 확인해 주세요.`);
  }

  return nextPosition;
}

/**
 * 브라우저의 Geolocation API를 사용하여 현재 디바이스의 최적 위치(위도, 경도, 정확도)를 획득하고,
 * 서비스 제약(반경/오차) 조건을 확인한 뒤 CurrentDeviceLocation 객체로 반환하는 Promise 함수입니다.
 * 타임아웃, 에러 핸들링, 조기 성공 로직 등을 내장합니다.
 */
export function getCurrentDevicePosition() {
  return new Promise<CurrentDeviceLocation>((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      reject(new Error('이 기기에서는 현재 위치 확인을 사용할 수 없어요.'));
      return;
    }

    let bestPosition: GeolocationPosition | null = null;
    let finished = false;
    let timeoutId = 0;

    const cleanup = (watchId: number) => {
      navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(timeoutId);
      finished = true;
    };

    const finishWithError = (watchId: number, error: Error) => {
      if (finished) {
        return;
      }
      cleanup(watchId);
      reject(error);
    };

    const finishWithBestPosition = (watchId: number) => {
      if (finished) {
        return;
      }

      if (!bestPosition) {
        cleanup(watchId);
        reject(new Error('현재 위치를 확인하지 못했어요.'));
        return;
      }

      try {
        const nextPosition = validateCurrentDevicePosition(bestPosition);
        cleanup(watchId);
        resolve(nextPosition);
      } catch (error) {
        cleanup(watchId);
        reject(error instanceof Error ? error : new Error('현재 위치를 확인하지 못했어요.'));
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }

        if (position.coords.accuracy <= EARLY_SUCCESS_LOCATION_ACCURACY_METERS) {
          finishWithBestPosition(watchId);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          finishWithError(watchId, new Error('브라우저 위치 권한이 꺼져 있어요. 위치 권한을 허용해 주세요.'));
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          finishWithError(watchId, new Error('현재 위치를 찾지 못했어요. GPS가 잘 잡히는 곳에서 다시 시도해 주세요.'));
          return;
        }
        if (error.code === error.TIMEOUT) {
          finishWithError(watchId, new Error('위치 확인 시간이 초과됐어요. 다시 시도해 주세요.'));
          return;
        }
        finishWithError(watchId, new Error('현재 위치를 확인하지 못했어요.'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      },
    );

    timeoutId = window.setTimeout(() => {
      finishWithBestPosition(watchId);
    }, 8_000);
  });
}
