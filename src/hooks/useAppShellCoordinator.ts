import { useAppCoordinatorActions } from './useAppCoordinatorActions';
import { useAppCoordinatorEffects } from './useAppCoordinatorEffects';
import { useAppCoordinatorServices } from './useAppCoordinatorServices';
import type { CoordinatorArgs } from './useAppShellCoordinator.types';

export function useAppShellCoordinator({
  routeState,
  domainState,
  shellRuntimeState,
  pageRuntimeState,
  dataState,
  initialMapViewport,
}: CoordinatorArgs) {
  const services = useAppCoordinatorServices({
    routeState,
    domainState,
    shellRuntimeState,
    pageRuntimeState,
    dataState,
  });

  useAppCoordinatorEffects({
    routeState,
    domainState,
    shellRuntimeState,
    pageRuntimeState,
    dataState,
    services,
  });

  const actions = useAppCoordinatorActions({
    routeState,
    domainState,
    shellRuntimeState,
    dataState,
    services,
  });

  return {
    ...services,
    ...actions,
    initialMapViewport,
    ...pageRuntimeState,
    ...domainState.auth,
    ...domainState.map,
    ...domainState.myPage,
    ...domainState.returnView,
    ...domainState.review,
    ...routeState,
    ...shellRuntimeState,
    ...dataState,
    ...services.navigationHelpers,
    ...services.paginationActions,
  };
}
