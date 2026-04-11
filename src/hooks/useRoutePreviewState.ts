import { useAppMapStore } from '../store/app-map-store';

export function useRoutePreviewState() {
  const selectedRoutePreview = useAppMapStore((state) => state.selectedRoutePreview);
  const setSelectedRoutePreview = useAppMapStore((state) => state.setSelectedRoutePreview);

  return {
    selectedRoutePreview,
    setSelectedRoutePreview,
  };
}
