import type { Category, Place } from '../types';

/**
 * 주어진 장소(Place) 배열에서, 전달받은 카테고리(Category) 조건과 일치하는 장소들만 필터링하여 반환합니다.
 * 'all'일 경우 배열 원본을 그대로 반환합니다.
 */
export function filterPlacesByCategory(places: Place[], category: Category) {
  if (category === 'all') {
    return places;
  }

  return places.filter((place) => place.category === category);
}
