import { useEffect, useRef, useState } from 'react';
import { getClientConfig } from '../config';
import type { ApiStatus, Place } from '../types';

declare global {
  interface Window {
    naver?: any;
  }
}

const DAEJEON_CENTER = { latitude: 36.3504, longitude: 127.3845 };
const DAEJEON_BOUNDS = {
  southWest: { latitude: 36.1907, longitude: 127.2629 },
  northEast: { latitude: 36.4905, longitude: 127.5429 },
};

let naverScriptPromise: Promise<any> | null = null;

function loadNaverMaps(clientId: string) {
  if (window.naver?.maps) {
    return Promise.resolve(window.naver.maps);
  }

  if (naverScriptPromise) {
    return naverScriptPromise;
  }

  naverScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    script.async = true;
    script.onload = () => {
      if (window.naver?.maps) {
        resolve(window.naver.maps);
        return;
      }
      reject(new Error('네이버 지도 SDK를 읽지 못했어요.'));
    };
    script.onerror = () => reject(new Error('네이버 지도 SDK 로딩에 실패했어요.'));
    document.head.appendChild(script);
  });

  return naverScriptPromise;
}

function placeMarkerContent(place: Place, isActive: boolean) {
  const ring = isActive ? '#5f4660' : 'rgba(64, 40, 51, 0.12)';
  const scale = isActive ? 'scale(1.08)' : 'scale(1)';

  return `
    <div style="transform:${scale};display:flex;flex-direction:column;align-items:center;gap:6px;">
      <div style="width:42px;height:36px;border-radius:16px 16px 12px 12px;background:linear-gradient(180deg,#fffaf2,#ffefce);box-shadow:0 10px 18px rgba(255,156,96,0.22);position:relative;border:2px solid ${ring};">
        <div style="position:absolute;left:50%;top:52%;width:18px;height:18px;border-radius:999px;background:${place.jamColor};transform:translate(-50%, -50%);box-shadow:0 0 0 5px rgba(255,255,255,0.76);"></div>
      </div>
      <div style="min-width:90px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,0.92);color:#402833;font-size:11px;font-weight:700;text-align:center;box-shadow:0 8px 18px rgba(255,127,168,0.12);">${place.name}</div>
    </div>
  `;
}

function currentLocationMarkerContent() {
  return `
    <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:rgba(255,255,255,0.92);box-shadow:0 6px 18px rgba(95,70,96,0.18);border:1px solid rgba(95,70,96,0.12);">
      <div style="width:12px;height:12px;border-radius:999px;background:#4f8cff;box-shadow:0 0 0 6px rgba(79,140,255,0.18);"></div>
    </div>
  `;
}

interface NaverMapProps {
  places: Place[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  currentPosition: { latitude: number; longitude: number } | null;
  currentLocationStatus: ApiStatus;
  currentLocationMessage: string | null;
  focusCurrentLocationKey: number;
  onLocateCurrentPosition: () => void;
}

export function NaverMap({
  places,
  selectedPlaceId,
  onSelectPlace,
  currentPosition,
  currentLocationStatus,
  currentLocationMessage,
  focusCurrentLocationKey,
  onLocateCurrentPosition,
}: NaverMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const placeMarkersRef = useRef<any[]>([]);
  const currentMarkerRef = useRef<any | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clientId = getClientConfig().naverMapClientId;

  useEffect(() => {
    if (!clientId) {
      setStatus('error');
      setErrorMessage('.env의 NAVER_MAP_CLIENT_ID 값을 넣어 주세요.');
      return;
    }

    if (!mapElementRef.current) {
      return;
    }

    let isMounted = true;

    loadNaverMaps(clientId)
      .then((maps) => {
        if (!isMounted || !mapElementRef.current || mapRef.current) {
          return;
        }

        mapRef.current = new maps.Map(mapElementRef.current, {
          center: new maps.LatLng(DAEJEON_CENTER.latitude, DAEJEON_CENTER.longitude),
          zoom: 12,
          minZoom: 10,
          scaleControl: false,
          logoControl: false,
          mapDataControl: false,
          zoomControl: true,
        });

        const bounds = new maps.LatLngBounds(
          new maps.LatLng(DAEJEON_BOUNDS.southWest.latitude, DAEJEON_BOUNDS.southWest.longitude),
          new maps.LatLng(DAEJEON_BOUNDS.northEast.latitude, DAEJEON_BOUNDS.northEast.longitude),
        );

        mapRef.current.fitBounds(bounds, { top: 44, right: 28, bottom: 44, left: 28 });
        setStatus('ready');
      })
      .catch((error: Error) => {
        if (!isMounted) {
          return;
        }
        setStatus('error');
        setErrorMessage(error.message);
      });

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current) {
      return;
    }

    const maps = window.naver.maps;
    placeMarkersRef.current.forEach((marker) => marker.setMap(null));
    placeMarkersRef.current = [];

    places.forEach((place) => {
      const marker = new maps.Marker({
        map: mapRef.current,
        position: new maps.LatLng(place.latitude, place.longitude),
        title: place.name,
        icon: {
          content: placeMarkerContent(place, place.id === selectedPlaceId),
          anchor: new maps.Point(45, 54),
        },
      });
      maps.Event.addListener(marker, 'click', () => onSelectPlace(place.id));
      placeMarkersRef.current.push(marker);
    });
  }, [onSelectPlace, places, selectedPlaceId, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current) {
      return;
    }

    const maps = window.naver.maps;

    if (!currentPosition) {
      if (currentMarkerRef.current) {
        currentMarkerRef.current.setMap(null);
        currentMarkerRef.current = null;
      }
      return;
    }

    const position = new maps.LatLng(currentPosition.latitude, currentPosition.longitude);
    if (!currentMarkerRef.current) {
      currentMarkerRef.current = new maps.Marker({
        map: mapRef.current,
        position,
        title: '현재 위치',
        zIndex: 200,
        icon: {
          content: currentLocationMarkerContent(),
          anchor: new maps.Point(14, 14),
        },
      });
      return;
    }

    currentMarkerRef.current.setPosition(position);
    currentMarkerRef.current.setMap(mapRef.current);
  }, [currentPosition, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current || !selectedPlaceId) {
      return;
    }

    const selectedPlace = places.find((place) => place.id === selectedPlaceId);
    if (!selectedPlace) {
      return;
    }

    mapRef.current.panTo(new window.naver.maps.LatLng(selectedPlace.latitude, selectedPlace.longitude));
  }, [places, selectedPlaceId, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current || !currentPosition || focusCurrentLocationKey === 0) {
      return;
    }

    mapRef.current.panTo(new window.naver.maps.LatLng(currentPosition.latitude, currentPosition.longitude));
  }, [currentPosition, focusCurrentLocationKey, status]);

  if (!clientId || status === 'error') {
    return (
      <div className="map-status-card">
        <strong>네이버 지도 연결 대기</strong>
        <p>{errorMessage || '네이버 지도 SDK를 불러오지 못했어요.'}</p>
      </div>
    );
  }

  return (
    <div className="map-surface-frame">
      {status === 'loading' && (
        <div className="map-status-card map-status-card--overlay">
          <strong>대전 지도를 준비하고 있어요.</strong>
          <p>키가 맞으면 실제 네이버 지도가 여기서 열려요.</p>
        </div>
      )}
      <div className="map-floating-controls">
        <button
          type="button"
          className="map-locate-button"
          onClick={onLocateCurrentPosition}
          disabled={currentLocationStatus === 'loading'}
        >
          {currentLocationStatus === 'loading' ? '위치 확인 중' : currentPosition ? '내 위치 보기' : '내 위치 켜기'}
        </button>
      </div>
      <div ref={mapElementRef} style={{ width: '100%', height: '360px' }} />
      {currentLocationMessage && <div className="map-location-pill">{currentLocationMessage}</div>}
      <div className="map-caption">대전 범위만 가볍게 보이도록 정리했어요.</div>
    </div>
  );
}
