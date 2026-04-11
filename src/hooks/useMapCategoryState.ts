import { useAppMapStore } from '../store/app-map-store';

export function useMapCategoryState() {
  const activeCategory = useAppMapStore((state) => state.activeCategory);
  const setActiveCategory = useAppMapStore((state) => state.setActiveCategory);

  return {
    activeCategory,
    setActiveCategory,
  };
}
