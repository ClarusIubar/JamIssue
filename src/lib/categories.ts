/**
 * 앱에서 사용하는 4가지 주요 장소 카테고리의 메타데이터(이름, 색상, 아이콘 등)를 정의합니다.
 */
﻿export const categoryInfo = {
  restaurant: {
    name: '맛집',
    color: '#FFB3C6',
    icon: '🍞',
    jamColor: '#FF6B9D',
  },
  cafe: {
    name: '카페',
    color: '#A8D5E2',
    icon: '☕',
    jamColor: '#7CB9D1',
  },
  attraction: {
    name: '명소',
    color: '#FFD4E0',
    icon: '🌸',
    jamColor: '#FFB3C6',
  },
  culture: {
    name: '문화',
    color: '#C9E4EA',
    icon: '🎨',
    jamColor: '#A8D5E2',
  },
} as const;

/**
 * 내부적으로 다루는 카테고리 식별자 타입입니다. ('restaurant' | 'cafe' | 'attraction' | 'culture')
 */
export type PlaceCategory = keyof typeof categoryInfo;

/**
 * 리스트 필터링 시 사용할 수 있는 카테고리 식별자 타입입니다. ('all' 포함)
 */
export type PlaceCategoryFilter = 'all' | PlaceCategory;

const cultureSlugHints = [
  'museum',
  'arts-center',
  'art-science',
  'science-museum',
  'observatory',
];

/**
 * 외부 시스템이나 공공 데이터의 카테고리 문자열을 받아, 앱 내부의 4가지 표준 카테고리 중 하나로 매핑하여 반환합니다.
 * 'landmark'의 경우 slug(식별자)를 분석하여 'culture'나 'attraction'으로 세분화합니다.
 */
export function normalizePlaceCategory(category: string, slug = ''): PlaceCategory {
  if (category === 'restaurant' || category === 'cafe' || category === 'attraction' || category === 'culture') {
    return category;
  }

  if (category === 'food') {
    return 'restaurant';
  }

  if (category === 'night') {
    return 'attraction';
  }

  if (category === 'landmark') {
    return cultureSlugHints.some((hint) => slug.includes(hint)) ? 'culture' : 'attraction';
  }

  return 'attraction';
}

/**
 * 탭이나 필터 메뉴 등에서 렌더링하기 편하도록 'all'을 포함한 카테고리 목록 배열을 제공합니다.
 */
export const categoryItems: { key: PlaceCategoryFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'restaurant', label: categoryInfo.restaurant.name },
  { key: 'cafe', label: categoryInfo.cafe.name },
  { key: 'attraction', label: categoryInfo.attraction.name },
  { key: 'culture', label: categoryInfo.culture.name },
];
