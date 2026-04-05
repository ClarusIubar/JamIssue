import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapTabStage } from '../../src/components/MapTabStage';
import { createReviewFixture, placeFixture, sessionUserFixture } from '../fixtures/app-fixtures';
import type { RoutePreview } from '../../src/types';

vi.mock('../../src/components/NaverMap', () => ({
  NaverMap: () => <div data-testid="naver-map" />,
}));

vi.mock('../../src/components/PlaceDetailSheet', () => ({
  PlaceDetailSheet: () => null,
}));

vi.mock('../../src/components/FestivalDetailSheet', () => ({
  FestivalDetailSheet: () => null,
}));

describe('MapTabStage route preview card', () => {
  it('opens the selected place detail directly from the route preview list', () => {
    const onOpenRoutePreviewPlace = vi.fn();
    const places = [
      { ...placeFixture, id: 'place-1', name: '첫 번째 장소' },
      { ...placeFixture, id: 'place-2', positionId: 'position-2', name: '두 번째 장소', latitude: 36.351, longitude: 127.385 },
    ];
    const routePreview: RoutePreview = {
      id: 'route-1',
      title: '빵집 산책 코스',
      subtitle: 'tester / 04. 05. 12:00',
      mood: '데이트',
      placeIds: places.map((place) => place.id),
      placeNames: places.map((place) => place.name),
    };

    render(
      <MapTabStage
        activeCategory="all"
        setActiveCategory={vi.fn()}
        filteredPlaces={places}
        festivals={[]}
        selectedPlace={null}
        selectedFestival={null}
        currentPosition={null}
        mapLocationStatus="idle"
        mapLocationFocusKey={0}
        drawerState="closed"
        sessionUser={sessionUserFixture}
        selectedPlaceReviews={[createReviewFixture()]}
        routePreview={routePreview}
        routePreviewPlaces={places}
        visitCount={0}
        latestStamp={null}
        todayStamp={null}
        stampActionStatus="idle"
        stampActionMessage="스탬프 안내"
        reviewProofMessage="리뷰 안내"
        reviewError={null}
        reviewSubmitting={false}
        canCreateReview={false}
        hasCreatedReviewToday={false}
        onOpenFeedReview={vi.fn()}
        onClearRoutePreview={vi.fn()}
        onOpenPlace={vi.fn()}
        onOpenRoutePreviewPlace={onOpenRoutePreviewPlace}
        onOpenFestival={vi.fn()}
        onCloseDrawer={vi.fn()}
        onExpandPlaceDrawer={vi.fn()}
        onCollapsePlaceDrawer={vi.fn()}
        onExpandFestivalDrawer={vi.fn()}
        onCollapseFestivalDrawer={vi.fn()}
        onRequestLogin={vi.fn()}
        onClaimStamp={vi.fn()}
        onCreateReview={vi.fn()}
        onLocateCurrentPosition={vi.fn()}
        onMapViewportChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '2. 두 번째 장소' }));

    expect(onOpenRoutePreviewPlace).toHaveBeenCalledWith('place-2');
  });
});
