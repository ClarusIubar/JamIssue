import { useCallback, useEffect } from 'react';
import { useAppMapStore } from '../store/app-map-store';
import { useAppRouteStore } from '../store/app-route-store';
import type { DrawerState, RoutePreview, Tab } from '../types';

export type RouteState = {
  tab: Tab;
  placeId: string | null;
  festivalId: string | null;
  drawerState: DrawerState;
};

export type AppHistoryState = RouteState & {
  routePreview: RoutePreview | null;
};

export type RouteStateCommitOptions = {
  routePreview?: RoutePreview | null;
};

const validTabs: Tab[] = ['map', 'event', 'feed', 'course', 'my'];

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

function isRoutePreview(value: unknown): value is RoutePreview {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<RoutePreview>;
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.subtitle === 'string'
    && typeof candidate.mood === 'string'
    && Array.isArray(candidate.placeIds)
    && Array.isArray(candidate.placeNames);
}

export function getRoutePreviewFromHistoryState(historyState: unknown): RoutePreview | null {
  if (!historyState || typeof historyState !== 'object') {
    return null;
  }

  const routePreview = (historyState as Partial<AppHistoryState>).routePreview;
  return isRoutePreview(routePreview) ? routePreview : null;
}

export function buildHistoryState(routeState: RouteState, routePreview: RoutePreview | null): AppHistoryState {
  return {
    ...routeState,
    routePreview: routePreview ?? null,
  };
}

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
  window.history.replaceState(window.history.state ?? {}, '', nextUrl);
}

export function getLoginReturnUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000/?tab=my';
  }

  return `${window.location.origin}/?tab=my`;
}

export interface MapViewport {
  lat: number;
  lng: number;
  zoom: number;
}

const DEFAULT_MAP_VIEWPORT: MapViewport = { lat: 36.3504, lng: 127.3845, zoom: 13 };

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

function initializeRouteStore() {
  if (routeStoreInitialized || typeof window === 'undefined') {
    return;
  }
  const routeState = getInitialRouteState();
  useAppRouteStore.setState({
    activeTab: routeState.tab,
    selectedPlaceId: routeState.tab === 'map' ? routeState.placeId : null,
    selectedFestivalId: routeState.tab === 'map' ? routeState.festivalId : null,
    drawerState: routeState.tab === 'map' ? routeState.drawerState : 'closed',
  });
  useAppMapStore.setState({ selectedRoutePreview: getRoutePreviewFromHistoryState(window.history.state) });
  routeStoreInitialized = true;
}

export function useAppRouteState() {
  initializeRouteStore();

  const activeTab = useAppRouteStore((state) => state.activeTab);
  const drawerState = useAppRouteStore((state) => state.drawerState);
  const selectedPlaceId = useAppRouteStore((state) => state.selectedPlaceId);
  const selectedFestivalId = useAppRouteStore((state) => state.selectedFestivalId);
  const setActiveTab = useAppRouteStore((state) => state.setActiveTab);
  const setDrawerState = useAppRouteStore((state) => state.setDrawerState);
  const setSelectedPlaceId = useAppRouteStore((state) => state.setSelectedPlaceId);
  const setSelectedFestivalId = useAppRouteStore((state) => state.setSelectedFestivalId);
  const selectedRoutePreview = useAppMapStore((state) => state.selectedRoutePreview);
  const setSelectedRoutePreview = useAppMapStore((state) => state.setSelectedRoutePreview);

  const applyRouteState = useCallback((routeState: RouteState, routePreview: RoutePreview | null = null) => {
    setActiveTab(routeState.tab);
    setSelectedPlaceId(routeState.tab === 'map' ? routeState.placeId : null);
    setSelectedFestivalId(routeState.tab === 'map' ? routeState.festivalId : null);
    setDrawerState(routeState.tab === 'map' ? routeState.drawerState : 'closed');
    setSelectedRoutePreview(routeState.tab === 'map' ? routePreview : null);
  }, [setActiveTab, setDrawerState, setSelectedFestivalId, setSelectedPlaceId, setSelectedRoutePreview]);

  const commitRouteState = useCallback(
    (routeState: RouteState, mode: 'push' | 'replace' = 'push', options?: RouteStateCommitOptions) => {
      const requestedRoutePreview = options && Object.prototype.hasOwnProperty.call(options, 'routePreview')
        ? options.routePreview ?? null
        : selectedRoutePreview;
      const nextRoutePreview = routeState.tab === 'map' ? requestedRoutePreview : null;
      applyRouteState(routeState, nextRoutePreview);
      if (typeof window === 'undefined') {
        return;
      }

      const nextUrl = buildRouteUrl(routeState);
      const nextHistoryState = buildHistoryState(routeState, nextRoutePreview);
      if (mode === 'replace') {
        window.history.replaceState(nextHistoryState, '', nextUrl);
        return;
      }

      window.history.pushState(nextHistoryState, '', nextUrl);
    },
    [applyRouteState, selectedRoutePreview],
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
        { routePreview: null },
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

    const handlePopState = (event: PopStateEvent) => {
      applyRouteState(getInitialRouteState(), getRoutePreviewFromHistoryState(event.state));
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
