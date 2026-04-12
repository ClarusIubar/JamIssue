import type {
  getInitialMapViewport,
  useAppRouteState,
} from './useAppRouteState';
import type { useAuthDomainState } from './useAuthDomainState';
import type { useAppShellRuntimeState } from './useAppShellRuntimeState';
import type { useAppPageRuntimeState } from './useAppPageRuntimeState';
import type { useAppDataState } from './useAppDataState';
import type { useMapDomainState } from './useMapDomainState';
import type { useMyPageDomainState } from './useMyPageDomainState';
import type { useReturnViewDomainState } from './useReturnViewDomainState';
import type { useReviewDomainState } from './useReviewDomainState';

export type RouteState = ReturnType<typeof useAppRouteState>;
export type DomainState = {
  auth: ReturnType<typeof useAuthDomainState>;
  map: ReturnType<typeof useMapDomainState>;
  myPage: ReturnType<typeof useMyPageDomainState>;
  returnView: ReturnType<typeof useReturnViewDomainState>;
  review: ReturnType<typeof useReviewDomainState>;
};
export type ShellRuntimeState = ReturnType<typeof useAppShellRuntimeState>;
export type PageRuntimeState = ReturnType<typeof useAppPageRuntimeState>;
export type DataState = ReturnType<typeof useAppDataState>;

export type CoordinatorArgs = {
  routeState: RouteState;
  domainState: DomainState;
  shellRuntimeState: ShellRuntimeState;
  pageRuntimeState: PageRuntimeState;
  dataState: DataState;
  initialMapViewport: ReturnType<typeof getInitialMapViewport>;
};
