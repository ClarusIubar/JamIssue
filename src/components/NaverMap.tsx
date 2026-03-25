import { useEffect, useRef, useState } from 'react';
import { getClientConfig } from '../config';
import { categoryInfo } from '../lib/categories';
import type { ApiStatus, FestivalItem, Place } from '../types';

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
      reject(new Error('네이버 지도 SDK를 찾지 못했어요.'));
    };
    script.onerror = () => reject(new Error('네이버 지도 SDK를 불러오지 못했어요.'));
    document.head.appendChild(script);
  });

  return naverScriptPromise;
}

function placeMarkerContent(place: Place, isActive: boolean) {
  const info = categoryInfo[place.category];
  const ring = isActive ? '#5f4660' : 'rgba(95, 70, 96, 0.18)';
  const scale = isActive ? 'scale(1.08)' : 'scale(1)';
  const shadow = isActive ? '0 14px 28px rgba(255,127,168,0.28)' : '0 10px 22px rgba(255,156,96,0.18)';
  const label = '';

  return `
    <div style="transform:${scale};display:flex;flex-direction:column;align-items:center;gap:6px;">
      <div style="position:relative;width:30px;height:30px;">
        <div style="position:absolute;left:50%;top:1px;width:10px;height:10px;border-radius:999px;background:${info.jamColor};transform:translateX(-50%);"></div>
        <div style="position:absolute;left:50%;bottom:1px;width:10px;height:10px;border-radius:999px;background:${info.jamColor};transform:translateX(-50%);"></div>
        <div style="position:absolute;left:1px;top:50%;width:10px;height:10px;border-radius:999px;background:${info.jamColor};transform:translateY(-50%);"></div>
        <div style="position:absolute;right:1px;top:50%;width:10px;height:10px;border-radius:999px;background:${info.jamColor};transform:translateY(-50%);"></div>
        <div style="position:absolute;inset:7px;border-radius:999px;background:${info.color};border:2px solid ${ring};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;color:#5f4660;font-size:10px;font-weight:900;">${info.icon}</div>
      </div>
      ${label}
    </div>
  `;
}

function festivalMarkerContent(festival: FestivalItem, isActive: boolean) {
  const ring = isActive ? '#ff4f93' : 'rgba(255, 79, 147, 0.22)';
  const scale = isActive ? 'scale(1.06)' : 'scale(1)';
  const label = '';

  return `
    <div style="transform:${scale};display:flex;flex-direction:column;align-items:center;gap:6px;">
      <div style="position:relative;width:30px;height:30px;">
        <div style="position:absolute;left:50%;top:1px;width:10px;height:10px;border-radius:999px;background:#ffd4e6;transform:translateX(-50%);"></div>
        <div style="position:absolute;left:50%;bottom:1px;width:10px;height:10px;border-radius:999px;background:#ffd4e6;transform:translateX(-50%);"></div>
        <div style="position:absolute;left:1px;top:50%;width:10px;height:10px;border-radius:999px;background:#ffd4e6;transform:translateY(-50%);"></div>
        <div style="position:absolute;right:1px;top:50%;width:10px;height:10px;border-radius:999px;background:#ffd4e6;transform:translateY(-50%);"></div>
        <div style="position:absolute;inset:8px;border-radius:999px;background:#fff4fa;border:2px solid ${ring};box-shadow:0 10px 24px rgba(255,93,146,0.18);display:flex;align-items:center;justify-content:center;color:#7b1948;font-size:8px;font-weight:900;">축제</div>
      </div>
      ${label}
    </div>
  `;
}

function hasFestivalCoordinates(festival: FestivalItem) {
  return typeof festival.latitude === 'number'
    && Number.isFinite(festival.latitude)
    && typeof festival.longitude === 'number'
    && Number.isFinite(festival.longitude);
}

function currentLocationMarkerContent() {
  return `
    <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:rgba(255,255,255,0.92);box-shadow:0 6px 18px rgba(95,70,96,0.18);border:1px solid rgba(95,70,96,0.12);">
      <div style="width:12px;height:12px;border-radius:999px;background:#4f8cff;box-shadow:0 0 0 6px rgba(79,140,255,0.18);"></div>
    </div>
  `;
}

function routeStepMarkerContent(step: number) {
  return `
    <div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:#5f4660;color:#fff;font-size:11px;font-weight:800;box-shadow:0 10px 24px rgba(95,70,96,0.22);border:2px solid rgba(255,255,255,0.9);">${step}</div>
  `;
}

interface NaverMapProps {
  places: Place[];
  festivals: FestivalItem[];
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  onSelectPlace: (placeId: string) => void;
  onSelectFestival: (festivalId: string) => void;
  currentPosition: { latitude: number; longitude: number } | null;
  currentLocationStatus: ApiStatus;
  currentLocationMessage: string | null;
  focusCurrentLocationKey: number;
  onLocateCurrentPosition: () => void;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onViewportChange?: (lat: number, lng: number, zoom: number) => void;
  routePreviewPlaces?: Place[];
  height?: string;
}

export function NaverMap({
  places,
  festivals,
  selectedPlaceId,
  selectedFestivalId,
  onSelectPlace,
  onSelectFestival,
  currentPosition,
  currentLocationStatus,
  currentLocationMessage,
  focusCurrentLocationKey,
  onLocateCurrentPosition,
  initialCenter,
  initialZoom,
  onViewportChange,
  routePreviewPlaces = [],
  height = '100%',
}: NaverMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const placeMarkersRef = useRef<Map<string, any>>(new Map());
  const festivalMarkersRef = useRef<Map<string, any>>(new Map());
  const currentMarkerRef = useRef<any | null>(null);
  const routeLineRef = useRef<any | null>(null);
  const routeStepMarkersRef = useRef<any[]>([]);
  const onViewportChangeRef = useRef(onViewportChange);
  const idleListenerRef = useRef<any>(null);
  const viewportDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const clientId = getClientConfig().naverMapClientId;

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    if (!clientId) {
      setStatus('error');
      setErrorMessage('네이버 지도 Client ID가 비어 있어요.');
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
          center: new maps.LatLng(
            initialCenter?.lat ?? DAEJEON_CENTER.latitude,
            initialCenter?.lng ?? DAEJEON_CENTER.longitude,
          ),
          zoom: initialZoom ?? 13,
          minZoom: 11,
          scaleControl: false,
          logoControl: false,
          mapDataControl: false,
          zoomControl: true,
        });

        const idleListener = maps.Event.addListener(mapRef.current, 'idle', () => {
          if (!mapRef.current) {
            return;
          }
          const center = mapRef.current.getCenter();
          const zoom = mapRef.current.getZoom();
          if (viewportDebounceTimerRef.current !== null) {
            clearTimeout(viewportDebounceTimerRef.current);
          }
          viewportDebounceTimerRef.current = setTimeout(() => {
            onViewportChangeRef.current?.(center.lat(), center.lng(), zoom);
            viewportDebounceTimerRef.current = null;
          }, 300);
        });
        idleListenerRef.current = idleListener;

        setStatus('ready');

        return () => {
          if (viewportDebounceTimerRef.current !== null) {
            clearTimeout(viewportDebounceTimerRef.current);
          }
          maps.Event.removeListener(idleListener);
        };
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
      if (viewportDebounceTimerRef.current !== null) {
        clearTimeout(viewportDebounceTimerRef.current);
        viewportDebounceTimerRef.current = null;
      }
      if (idleListenerRef.current && window.naver?.maps) {
        window.naver.maps.Event.removeListener(idleListenerRef.current);
        idleListenerRef.current = null;
      }
    };
  }, [clientId]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current) {
      return;
    }

    const maps = window.naver.maps;
    const nextIds = new Set(places.map((place) => place.id));

    for (const [placeId, marker] of placeMarkersRef.current.entries()) {
      if (!nextIds.has(placeId)) {
        marker.setMap(null);
        placeMarkersRef.current.delete(placeId);
      }
    }

    places.forEach((place) => {
      const existing = placeMarkersRef.current.get(place.id);
      const position = new maps.LatLng(place.latitude, place.longitude);
      if (existing) {
        existing.setPosition(position);
        return;
      }

      const marker = new maps.Marker({
        map: mapRef.current,
        position,
        title: '',
        icon: {
          content: placeMarkerContent(place, place.id === selectedPlaceId),
          anchor: new maps.Point(15, 15),
        },
      });
      maps.Event.addListener(marker, 'click', () => onSelectPlace(place.id));
      placeMarkersRef.current.set(place.id, marker);
    });
  }, [onSelectPlace, places, selectedPlaceId, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current) {
      return;
    }

    const maps = window.naver.maps;
    places.forEach((place) => {
      const marker = placeMarkersRef.current.get(place.id);
      if (!marker) {
        return;
      }
      marker.setIcon({
        content: placeMarkerContent(place, place.id === selectedPlaceId),
        anchor: new maps.Point(15, 15),
      });
      marker.setZIndex(place.id === selectedPlaceId ? 160 : 100);
    });
  }, [places, selectedPlaceId, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current) {
      return;
    }

    const maps = window.naver.maps;
    const nextIds = new Set(festivals.filter(hasFestivalCoordinates).map((festival) => festival.id));

    for (const [festivalId, marker] of festivalMarkersRef.current.entries()) {
      if (!nextIds.has(festivalId)) {
        marker.setMap(null);
        festivalMarkersRef.current.delete(festivalId);
      }
    }

    festivals.forEach((festival) => {
      if (!hasFestivalCoordinates(festival)) {
        return;
      }
      const existing = festivalMarkersRef.current.get(festival.id);
      const position = new maps.LatLng(festival.latitude, festival.longitude);
      if (existing) {
        existing.setPosition(position);
        return;
      }

      const marker = new maps.Marker({
        map: mapRef.current,
        position,
        title: '',
        zIndex: festival.id === selectedFestivalId ? 170 : 110,
        icon: {
          content: festivalMarkerContent(festival, festival.id === selectedFestivalId),
          anchor: new maps.Point(15, 15),
        },
      });
      maps.Event.addListener(marker, 'click', () => onSelectFestival(festival.id));
      festivalMarkersRef.current.set(festival.id, marker);
    });
  }, [festivals, onSelectFestival, selectedFestivalId, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current) {
      return;
    }

    const maps = window.naver.maps;
    festivals.forEach((festival) => {
      const marker = festivalMarkersRef.current.get(festival.id);
      if (!marker) {
        return;
      }
      marker.setIcon({
        content: festivalMarkerContent(festival, festival.id === selectedFestivalId),
        anchor: new maps.Point(15, 15),
      });
      marker.setZIndex(festival.id === selectedFestivalId ? 170 : 110);
    });
  }, [festivals, selectedFestivalId, status]);

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
        title: '',
        zIndex: 200,
        icon: {
          content: currentLocationMarkerContent(),
          anchor: new maps.Point(15, 15),
        },
      });
      return;
    }

    currentMarkerRef.current.setPosition(position);
    currentMarkerRef.current.setMap(mapRef.current);
  }, [currentPosition, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current) {
      return;
    }

    const selectedPlace = selectedPlaceId ? places.find((place) => place.id === selectedPlaceId) : null;
    const selectedFestival = selectedFestivalId ? festivals.find((festival) => festival.id === selectedFestivalId) : null;
    const target = selectedPlace
      ? { latitude: selectedPlace.latitude, longitude: selectedPlace.longitude }
      : selectedFestival && hasFestivalCoordinates(selectedFestival)
        ? { latitude: selectedFestival.latitude, longitude: selectedFestival.longitude }
        : null;

    if (!target) {
      return;
    }

    const map = mapRef.current;
    const targetLatLng = new window.naver.maps.LatLng(target.latitude, target.longitude);
    const currentZoom = typeof map.getZoom === 'function' ? Number(map.getZoom()) : 13;
    const nextZoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, 15) : 15;

    if (typeof map.setZoom === 'function' && currentZoom < nextZoom) {
      map.setZoom(nextZoom, false);
    }

    if (typeof map.panTo === 'function') {
      map.panTo(targetLatLng);
    } else if (typeof map.setCenter === 'function') {
      map.setCenter(targetLatLng);
    }

    if (typeof map.panBy === 'function') {
      window.setTimeout(() => {
        if (mapRef.current === map) {
          map.panBy(0, -110);
        }
      }, 180);
    }
  }, [festivals, places, selectedFestivalId, selectedPlaceId, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current || !currentPosition || focusCurrentLocationKey === 0) {
      return;
    }

    mapRef.current.panTo(new window.naver.maps.LatLng(currentPosition.latitude, currentPosition.longitude));
  }, [currentPosition, focusCurrentLocationKey, status]);

  useEffect(() => {
    if (status !== 'ready' || !window.naver?.maps || !mapRef.current) {
      return;
    }

    const maps = window.naver.maps;
    if (routeLineRef.current) {
      routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }
    routeStepMarkersRef.current.forEach((marker) => marker.setMap(null));
    routeStepMarkersRef.current = [];

    if (!routePreviewPlaces || routePreviewPlaces.length === 0) {
      return;
    }

    const path = routePreviewPlaces.map((place) => new maps.LatLng(place.latitude, place.longitude));
    routeLineRef.current = new maps.Polyline({
      map: mapRef.current,
      path,
      strokeColor: '#ff6b9d',
      strokeOpacity: 0.82,
      strokeWeight: 4,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      zIndex: 120,
    });

    routeStepMarkersRef.current = routePreviewPlaces.map((place, index) => new maps.Marker({
      map: mapRef.current,
      position: new maps.LatLng(place.latitude, place.longitude),
      title: '',
      zIndex: 165,
      icon: {
        content: routeStepMarkerContent(index + 1),
        anchor: new maps.Point(13, 13),
      },
    }));

    if (routePreviewPlaces.length >= 2 && !selectedPlaceId && !selectedFestivalId) {
      const bounds = new maps.LatLngBounds();
      routePreviewPlaces.forEach((place) => bounds.extend(new maps.LatLng(place.latitude, place.longitude)));
      mapRef.current.fitBounds(bounds, { top: 72, right: 40, bottom: 120, left: 40 });
    } else if (routePreviewPlaces.length === 1 && !selectedPlaceId && !selectedFestivalId) {
      mapRef.current.panTo(new maps.LatLng(routePreviewPlaces[0].latitude, routePreviewPlaces[0].longitude));
    }
  }, [routePreviewPlaces, selectedFestivalId, selectedPlaceId, status]);


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
          <strong>대전 지도를 준비하고 있어요</strong>
          <p>잠시만 기다리면 지도와 마커를 바로 보여드릴게요.</p>
        </div>
      )}
      <div className="map-floating-controls">
        <button type="button" className="map-locate-button" onClick={onLocateCurrentPosition} disabled={currentLocationStatus === 'loading'}>
          {currentLocationStatus === 'loading' ? '확인 중' : currentPosition ? '내 위치 보기' : '내 위치 켜기'}
        </button>
      </div>
      <div ref={mapElementRef} style={{ width: '100%', height }} />
      {currentLocationMessage && <div className="map-location-pill">{currentLocationMessage}</div>}
    </div>
  );
}







