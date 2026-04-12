import { useMapCategoryState } from './useMapCategoryState';
import { useRoutePreviewState } from './useRoutePreviewState';

export function useMapDomainState() {
  return {
    ...useMapCategoryState(),
    ...useRoutePreviewState(),
  };
}
