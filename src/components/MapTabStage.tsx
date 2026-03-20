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
  SessionUser,
} from '../types';

interface MapTabStageProps {
  activeCategory: Category;
  setActiveCategory: (category: Category) => void;
  notice: string | null;
  bootstrapStatus: ApiStatus;
  bootstrapError: string | null;
  filteredPlaces: Place[];
  festivals: FestivalItem[];
  selectedPlace: Place | null;
  selectedFestival: FestivalItem | null;
  currentPosition: { latitude: number; longitude: number } | null;
  mapLocationStatus: ApiStatus;
  mapLocationMessage: string | null;
  mapLocationFocusKey: number;
  drawerState: DrawerState;
  sessionUser: SessionUser | null;
  selectedPlaceReviews: BootstrapResponse['reviews'];
  visitCount: number;
  latestStamp: BootstrapResponse['stamps']['logs'][number] | null;
  todayStamp: BootstrapResponse['stamps']['logs'][number] | null;
  stampActionStatus: ApiStatus;
  stampActionMessage: string;
  reviewProofMessage: string;
  reviewError: string | null;
  reviewSubmitting: boolean;
  reviewLikeUpdatingId: string | null;
  commentSubmittingReviewId: string | null;
  canCreateReview: boolean;
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
  onToggleReviewLike: (reviewId: string) => Promise<void>;
  onCreateComment: (reviewId: string, body: string, parentId?: string) => Promise<void>;
  onLocateCurrentPosition: () => void;
  onMapViewportChange: (lat: number, lng: number, zoom: number) => void;
}

export function MapTabStage({
  activeCategory,
  setActiveCategory,
  notice,
  bootstrapStatus,
  bootstrapError,
  filteredPlaces,
  festivals,
  selectedPlace,
  selectedFestival,
  currentPosition,
  mapLocationStatus,
  mapLocationMessage,
  mapLocationFocusKey,
  drawerState,
  sessionUser,
  selectedPlaceReviews,
  visitCount,
  latestStamp,
  todayStamp,
  stampActionStatus,
  stampActionMessage,
  reviewProofMessage,
  reviewError,
  reviewSubmitting,
  reviewLikeUpdatingId,
  commentSubmittingReviewId,
  canCreateReview,
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
  onToggleReviewLike,
  onCreateComment,
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
                {info ? `${info.icon} ${item.label}` : item.label}
              </button>
            );
          })}
        </div>
      </div>

      {notice && <div className="floating-notice">{notice}</div>}
      {bootstrapStatus === 'loading' && <section className="floating-status">대전 장소와 축제를 불러오고 있어요.</section>}
      {bootstrapStatus === 'error' && <section className="floating-status floating-status--error">{bootstrapError}</section>}

      <NaverMap
        places={filteredPlaces}
        festivals={festivals}
        selectedPlaceId={selectedPlace?.id ?? null}
        selectedFestivalId={selectedFestival?.id ?? null}
        onSelectPlace={onOpenPlace}
        onSelectFestival={onOpenFestival}
        currentPosition={currentPosition}
        currentLocationStatus={mapLocationStatus}
        currentLocationMessage={drawerState === 'closed' ? mapLocationMessage : null}
        focusCurrentLocationKey={mapLocationFocusKey}
        onLocateCurrentPosition={onLocateCurrentPosition}
        initialCenter={initialMapCenter}
        initialZoom={initialMapZoom}
        onViewportChange={onMapViewportChange}
        height="100%"
      />

      {!selectedPlace && !selectedFestival && (
        <section className="map-drawer-teaser">
          <span className="map-drawer-teaser__handle" aria-hidden="true" />
          <div>
            <strong>아래 시트에서 상세를 확인해요</strong>
            <p>지도 마커를 누르면 장소 정보, 현장 스탬프, 축제 안내가 아래에서 바로 열립니다.</p>
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
        stampActionStatus={stampActionStatus}
        stampActionMessage={stampActionMessage}
        reviewProofMessage={reviewProofMessage}
        reviewError={reviewError}
        reviewSubmitting={reviewSubmitting}
        reviewLikeUpdatingId={reviewLikeUpdatingId}
        commentSubmittingReviewId={commentSubmittingReviewId}
        canCreateReview={canCreateReview}
        onClose={onCloseDrawer}
        onExpand={onExpandPlaceDrawer}
        onCollapse={onCollapsePlaceDrawer}
        onRequestLogin={onRequestLogin}
        onClaimStamp={onClaimStamp}
        onCreateReview={onCreateReview}
        onToggleReviewLike={onToggleReviewLike}
        onCreateComment={onCreateComment}
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
