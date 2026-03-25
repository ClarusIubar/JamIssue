import { categoryInfo, categoryItems } from '../lib/categories';
import { FestivalDetailSheet } from './FestivalDetailSheet';
import { NaverMap } from './NaverMap';
import { PlaceDetailSheet } from './PlaceDetailSheet';
import type {
  ApiStatus,
  BootstrapResponse,
  Category,
  DrawerState,
  FestivalItem,
  Place,
  ReviewMood,
  RoutePreview,
  SessionUser,
} from '../types';

interface MapTabStageProps {
  activeCategory: Category;
  setActiveCategory: (category: Category) => void;
  filteredPlaces: Place[];
  festivals: FestivalItem[];
  selectedPlace: Place | null;
  selectedFestival: FestivalItem | null;
  currentPosition: { latitude: number; longitude: number } | null;
  mapLocationStatus: ApiStatus;
  mapLocationFocusKey: number;
  drawerState: DrawerState;
  sessionUser: SessionUser | null;
  selectedPlaceReviews: BootstrapResponse['reviews'];
  routePreview: RoutePreview | null;
  routePreviewPlaces: Place[];
  visitCount: number;
  latestStamp: BootstrapResponse['stamps']['logs'][number] | null;
  todayStamp: BootstrapResponse['stamps']['logs'][number] | null;
  stampActionStatus: ApiStatus;
  stampActionMessage: string;
  reviewProofMessage: string;
  reviewError: string | null;
  reviewSubmitting: boolean;
  canCreateReview: boolean;
  hasCreatedReviewToday: boolean;
  onOpenFeedReview: () => void;
  onClearRoutePreview: () => void;
  initialMapCenter?: { lat: number; lng: number };
  initialMapZoom?: number;
  onOpenPlace: (placeId: string) => void;
  onOpenFestival: (festivalId: string) => void;
  onCloseDrawer: () => void;
  onExpandPlaceDrawer: () => void;
  onCollapsePlaceDrawer: () => void;
  onExpandFestivalDrawer: () => void;
  onCollapseFestivalDrawer: () => void;
  onRequestLogin: () => void;
  onClaimStamp: (place: Place) => Promise<void>;
  onCreateReview: (payload: { stampId: string; body: string; mood: ReviewMood; file: File | null }) => Promise<void>;
  onLocateCurrentPosition: () => void;
  onMapViewportChange: (lat: number, lng: number, zoom: number) => void;
}

export function MapTabStage({
  activeCategory,
  setActiveCategory,
  filteredPlaces,
  festivals,
  selectedPlace,
  selectedFestival,
  currentPosition,
  mapLocationStatus,
  mapLocationFocusKey,
  drawerState,
  sessionUser,
  selectedPlaceReviews,
  routePreview,
  routePreviewPlaces,
  visitCount,
  latestStamp,
  todayStamp,
  stampActionStatus,
  stampActionMessage,
  reviewProofMessage,
  reviewError,
  reviewSubmitting,
  canCreateReview,
  hasCreatedReviewToday,
  onOpenFeedReview,
  onClearRoutePreview,
  initialMapCenter,
  initialMapZoom,
  onOpenPlace,
  onOpenFestival,
  onCloseDrawer,
  onExpandPlaceDrawer,
  onCollapsePlaceDrawer,
  onExpandFestivalDrawer,
  onCollapseFestivalDrawer,
  onRequestLogin,
  onClaimStamp,
  onCreateReview,
  onLocateCurrentPosition,
  onMapViewportChange,
}: MapTabStageProps) {
  return (
    <div className="map-stage">
      <header className="map-stage__header map-stage__header--brand-only">
        <div className="map-stage__brand map-stage__brand--row">
          <div className="map-stage__brand-mark" aria-hidden="true">J</div>
          <div className="map-stage__brand-copy">
            <p className="map-stage__brand-kicker">DAEJEON LOCAL GUIDE</p>
            <h1 className="map-stage__brand-title">JAM ISSUE</h1>
          </div>
        </div>
      </header>

      <div className="map-filter-strip">
        <div className="chip-row compact-gap">
          {categoryItems.map((item) => {
            const isActive = item.key === activeCategory;
            const info = item.key === 'all' ? null : categoryInfo[item.key];
            return (
              <button
                key={item.key}
                type="button"
                className={isActive ? 'chip is-active map-filter-chip' : 'chip map-filter-chip'}
                onClick={() => setActiveCategory(item.key)}
                style={
                  info
                    ? {
                        background: isActive ? info.color : 'rgba(255,255,255,0.94)',
                        borderColor: info.jamColor,
                        color: '#4a3140',
                      }
                    : undefined
                }
              >
                {info ? String(info.icon) + ' ' + item.label : item.label}
              </button>
            );
          })}
        </div>
      </div>

      <NaverMap
        places={filteredPlaces}
        festivals={festivals}
        selectedPlaceId={selectedPlace?.id ?? null}
        selectedFestivalId={selectedFestival?.id ?? null}
        onSelectPlace={onOpenPlace}
        onSelectFestival={onOpenFestival}
        currentPosition={currentPosition}
        currentLocationStatus={mapLocationStatus}
        currentLocationMessage={null}
        focusCurrentLocationKey={mapLocationFocusKey}
        onLocateCurrentPosition={onLocateCurrentPosition}
        initialCenter={initialMapCenter}
        initialZoom={initialMapZoom}
        onViewportChange={onMapViewportChange}
        routePreviewPlaces={routePreviewPlaces}
        height="100%"
      />

      {!selectedPlace && !selectedFestival && routePreview && (
        <section className="map-route-preview-card">
          <div className="map-route-preview-card__top">
            <div>
              <p className="eyebrow">ROUTE PREVIEW</p>
              <h3>{routePreview.title}</h3>
              <p className="section-copy">{routePreview.subtitle}</p>
            </div>
            <button type="button" className="map-route-preview-card__close" onClick={onClearRoutePreview} aria-label="경로 미리보기 닫기">
              <span aria-hidden="true">{'\u00D7'}</span>
            </button>
          </div>
          <div className="course-card__places community-route-places map-route-preview-card__places">
            {routePreview.placeNames.map((placeName, index) => (
              <span key={routePreview.id + '-' + placeName + '-' + index} className="soft-tag">
                {index + 1}. {placeName}
              </span>
            ))}
          </div>
        </section>
      )}

      {!selectedPlace && !selectedFestival && (
        <section className="map-drawer-teaser">
          <span className="map-drawer-teaser__handle" aria-hidden="true" />
          <div className="map-drawer-teaser__peek" aria-hidden="true">
            <div className="map-drawer-teaser__line" />
            <div className="map-drawer-teaser__line map-drawer-teaser__line--short" />
            <div className="map-drawer-teaser__chips">
              <span className="map-drawer-teaser__chip" />
              <span className="map-drawer-teaser__chip" />
              <span className="map-drawer-teaser__chip map-drawer-teaser__chip--wide" />
            </div>
          </div>
        </section>
      )}

      <PlaceDetailSheet
        place={selectedPlace}
        reviews={selectedPlaceReviews}
        isOpen={Boolean(selectedPlace) && drawerState !== 'closed'}
        drawerState={drawerState}
        loggedIn={Boolean(sessionUser)}
        visitCount={visitCount}
        latestStamp={latestStamp}
        todayStamp={todayStamp}
        hasCreatedReviewToday={hasCreatedReviewToday}
        stampActionStatus={stampActionStatus}
        stampActionMessage={stampActionMessage}
        reviewProofMessage={reviewProofMessage}
        reviewError={reviewError}
        reviewSubmitting={reviewSubmitting}
        canCreateReview={canCreateReview}
        onOpenFeedReview={onOpenFeedReview}
        onClose={onCloseDrawer}
        onExpand={onExpandPlaceDrawer}
        onCollapse={onCollapsePlaceDrawer}
        onRequestLogin={onRequestLogin}
        onClaimStamp={onClaimStamp}
        onCreateReview={onCreateReview}
      />

      <FestivalDetailSheet
        festival={selectedFestival}
        isOpen={Boolean(selectedFestival) && drawerState !== 'closed'}
        drawerState={drawerState}
        onClose={onCloseDrawer}
        onExpand={onExpandFestivalDrawer}
        onCollapse={onCollapseFestivalDrawer}
      />
    </div>
  );
}
