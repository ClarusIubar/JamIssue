import { useCallback, useEffect } from 'react';
import { useAppUIStore } from '../store/app-ui-store';
import type { DrawerState, Tab } from '../types';

/**
 * 앱의 주요 UI 상태(선택된 탭, 열려있는 장소/축제 바텀시트 정보 등)를
 * 브라우저 주소 표시줄(URL Query)과 동기화하기 위해 사용하는 라우트 상태 타입입니다.
 */
export type RouteState = {
  tab: Tab;
  placeId: string | null;
  festivalId: string | null;
  drawerState: DrawerState;
};

const validTabs: Tab[] = ['map', 'event', 'feed', 'course', 'my'];

/**
 * 브라우저 URL의 쿼리 파라미터를 읽어와 앱 진입 시의 초기 상태(RouteState)를 구성합니다.
 * 인증 관련 콜백 파라미터가 있으면 마이페이지로 유도합니다.
 */
export function getInitialRouteState(): RouteState {
  if (typeof window === 'undefined') {
    return { tab: 'map', placeId: null, festivalId: null, drawerState: 'closed' };
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  const placeId = params.get('place');
  const festivalId = params.get('festival');
  const drawer = params.get('drawer');
  const resolvedTab = tab && validTabs.includes(tab as Tab) ? (tab as Tab) : params.get('auth') ? 'my' : 'map';
  const resolvedDrawer = drawer === 'full' || drawer === 'partial' ? drawer : placeId || festivalId ? 'partial' : 'closed';

  return {
    tab: resolvedTab,
    placeId: placeId || null,
    festivalId: festivalId || null,
    drawerState: resolvedDrawer,
  };
}

/**
 * 주어진 상태(RouteState)를 반영한 새로운 URL 문자열(path + query)을 생성합니다.
 */
export function buildRouteUrl(routeState: RouteState) {
  if (typeof window === 'undefined') {
    return '/';
  }

  const params = new URLSearchParams(window.location.search);
  params.set('tab', routeState.tab);

  if (routeState.tab === 'map' && routeState.placeId) {
    params.set('place', routeState.placeId);
    params.delete('festival');
    params.set('drawer', routeState.drawerState === 'closed' ? 'partial' : routeState.drawerState);
  } else if (routeState.tab === 'map' && routeState.festivalId) {
    params.set('festival', routeState.festivalId);
    params.delete('place');
    params.set('drawer', routeState.drawerState === 'closed' ? 'partial' : routeState.drawerState);
  } else {
    params.delete('place');
    params.delete('festival');
    params.delete('drawer');
  }

  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

/**
 * 소셜 로그인 콜백 등에서 전달받은 auth 관련 파라미터를 해석하여,
 * 사용자에게 띄워줄 초기 알림 메시지를 생성합니다.
 */
export function getInitialNotice() {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  const reason = params.get('reason');
  if (auth === 'naver-success') {
    return '네이버 로그인을 연결했어요.';
  }
  if (auth === 'naver-linked') {
    return '네이버 계정을 연결했어요.';
  }
  if (auth === 'naver-error') {
    return reason ? `네이버 로그인에 실패했어요. (${reason})` : '네이버 로그인에 실패했어요.';
  }
  return null;
}

/**
 * 초기 처리가 끝난 뒤 URL에 남아있는 인증 관련 파라미터(auth, reason)를 제거하여 URL을 깔끔하게 만듭니다.
 */
export function clearAuthQueryParams() {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (!params.has('auth') && !params.has('reason')) {
    return;
  }

  params.delete('auth');
  params.delete('reason');
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
  window.history.replaceState({}, '', nextUrl);
}

/**
 * 로그인을 마친 뒤 돌아올 URL을 생성합니다. 기본적으로 마이페이지 탭으로 이동시킵니다.
 */
export function getLoginReturnUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000/?tab=my';
  }

  return `${window.location.origin}/?tab=my`;
}

/**
 * 지도의 중심 좌표와 줌 레벨을 저장하는 뷰포트 인터페이스입니다.
 */
export interface MapViewport {
  lat: number;
  lng: number;
  zoom: number;
}

const DEFAULT_MAP_VIEWPORT: MapViewport = { lat: 36.3504, lng: 127.3845, zoom: 13 };

/**
 * URL에서 지도의 초기 뷰포트(lat, lng, z) 값을 읽어옵니다.
 * 값이 없거나 잘못되었으면 대전 중심의 기본값을 반환합니다.
 */
export function getInitialMapViewport(): MapViewport {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_MAP_VIEWPORT };
  }

  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get('lat') ?? '');
  const lng = parseFloat(params.get('lng') ?? '');
  const zoom = parseInt(params.get('z') ?? '', 10);

  return {
    lat: Number.isFinite(lat) ? lat : DEFAULT_MAP_VIEWPORT.lat,
    lng: Number.isFinite(lng) ? lng : DEFAULT_MAP_VIEWPORT.lng,
    zoom: Number.isFinite(zoom) ? zoom : DEFAULT_MAP_VIEWPORT.zoom,
  };
}

/**
 * 지도를 드래그하거나 확대/축소할 때 현재 뷰포트 값을 URL 쿼리 파라미터에(히스토리 교체 방식으로) 반영합니다.
 */
export function updateMapViewportInUrl(lat: number, lng: number, zoom: number) {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  params.set('lat', lat.toFixed(5));
  params.set('lng', lng.toFixed(5));
  params.set('z', String(zoom));
  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(window.history.state, '', nextUrl);
}

let routeStoreInitialized = false;

/**
 * (내부용) 훅 호출 시 한 번만 URL 기반의 초기 라우트 상태를 Zustand 스토어에 동기화합니다.
 */
function initializeRouteStore() {
  if (routeStoreInitialized || typeof window === 'undefined') {
    return;
  }
  const routeState = getInitialRouteState();
  useAppUIStore.setState({
    activeTab: routeState.tab,
    selectedPlaceId: routeState.tab === 'map' ? routeState.placeId : null,
    selectedFestivalId: routeState.tab === 'map' ? routeState.festivalId : null,
    drawerState: routeState.tab === 'map' ? routeState.drawerState : 'closed',
  });
  routeStoreInitialized = true;
}

/**
 * 앱의 탭 이동, 바텀 시트 열기/닫기 등 라우팅 상태를 관리하고 브라우저 히스토리와 연동하는 커스텀 훅입니다.
 */
export function useAppRouteState() {
  initializeRouteStore();

  const activeTab = useAppUIStore((state) => state.activeTab);
  const drawerState = useAppUIStore((state) => state.drawerState);
  const selectedPlaceId = useAppUIStore((state) => state.selectedPlaceId);
  const selectedFestivalId = useAppUIStore((state) => state.selectedFestivalId);
  const setActiveTab = useAppUIStore((state) => state.setActiveTab);
  const setDrawerState = useAppUIStore((state) => state.setDrawerState);
  const setSelectedPlaceId = useAppUIStore((state) => state.setSelectedPlaceId);
  const setSelectedFestivalId = useAppUIStore((state) => state.setSelectedFestivalId);

  const applyRouteState = useCallback((routeState: RouteState) => {
    setActiveTab(routeState.tab);
    setSelectedPlaceId(routeState.tab === 'map' ? routeState.placeId : null);
    setSelectedFestivalId(routeState.tab === 'map' ? routeState.festivalId : null);
    setDrawerState(routeState.tab === 'map' ? routeState.drawerState : 'closed');
  }, [setActiveTab, setDrawerState, setSelectedFestivalId, setSelectedPlaceId]);

  const commitRouteState = useCallback(
    (routeState: RouteState, mode: 'push' | 'replace' = 'push') => {
      applyRouteState(routeState);
      if (typeof window === 'undefined') {
        return;
      }

      const nextUrl = buildRouteUrl(routeState);
      if (mode === 'replace') {
        window.history.replaceState(routeState, '', nextUrl);
        return;
      }

      window.history.pushState(routeState, '', nextUrl);
    },
    [applyRouteState],
  );

  const goToTab = useCallback(
    (nextTab: Tab, mode: 'push' | 'replace' = 'push') => {
      commitRouteState(
        {
          tab: nextTab,
          placeId: null,
          festivalId: null,
          drawerState: 'closed',
        },
        mode,
      );
    },
    [commitRouteState],
  );

  const openPlace = useCallback(
    (placeId: string) => {
      commitRouteState({
        tab: 'map',
        placeId,
        festivalId: null,
        drawerState: 'partial',
      });
    },
    [commitRouteState],
  );

  const openFestival = useCallback(
    (festivalId: string) => {
      commitRouteState({
        tab: 'map',
        placeId: null,
        festivalId,
        drawerState: 'partial',
      });
    },
    [commitRouteState],
  );

  const closeDrawer = useCallback(() => {
    commitRouteState({
      tab: 'map',
      placeId: null,
      festivalId: null,
      drawerState: 'closed',
    });
  }, [commitRouteState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handlePopState = () => {
      applyRouteState(getInitialRouteState());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [applyRouteState]);

  return {
    activeTab,
    drawerState,
    selectedPlaceId,
    selectedFestivalId,
    setSelectedPlaceId,
    setSelectedFestivalId,
    commitRouteState,
    goToTab,
    openPlace,
    openFestival,
    closeDrawer,
  };
}
