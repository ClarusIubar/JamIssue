import { MapTabStage } from './MapTabStage';
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

interface AppMapStageViewProps {
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
  initialMapViewport: { lat: number; lng: number; zoom: number };
  onOpenPlaceFeed: () => void;
  onOpenPlace: (placeId: string) => void;
  onOpenFestival: (festivalId: string) => void;
  onCloseDrawer: () => void;
  onClearRoutePreview: () => void;
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

export function AppMapStageView({
  initialMapViewport,
  onOpenPlaceFeed,
  ...props
}: AppMapStageViewProps) {
  return (
    <MapTabStage
      {...props}
      onOpenFeedReview={onOpenPlaceFeed}
      initialMapCenter={{ lat: initialMapViewport.lat, lng: initialMapViewport.lng }}
      initialMapZoom={initialMapViewport.zoom}
    />
  );
}
