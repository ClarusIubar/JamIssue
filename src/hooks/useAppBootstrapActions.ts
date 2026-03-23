import { getFestivals, getMapBootstrap, getProviderLoginUrl } from '../api/client';
import { getCurrentDevicePosition } from '../lib/geolocation';
import { clearAuthQueryParams, getLoginReturnUrl } from './useAppRouteState';
import type { AuthProvider, FestivalItem, MyPageResponse, Place, SessionUser, StampState, Tab } from '../types';
import type { Dispatch, SetStateAction } from 'react';

type SetState<T> = Dispatch<SetStateAction<T>>;

type MapLocationStatus = 'idle' | 'loading' | 'ready' | 'error';
type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UseAppBootstrapActionsParams {
  activeTab: Tab;
  resetReviewCaches: () => void;
  refreshMyPageForUser: (user: SessionUser | null, force?: boolean) => Promise<MyPageResponse | null>;
  goToTab: (nextTab: Tab, historyMode?: 'push' | 'replace') => void;
  setBootstrapStatus: SetState<BootstrapStatus>;
  setBootstrapError: SetState<string | null>;
  setPlaces: SetState<Place[]>;
  setFestivals: SetState<FestivalItem[]>;
  setStampState: SetState<StampState>;
  setHasRealData: SetState<boolean>;
  setSessionUser: SetState<SessionUser | null>;
  setProviders: SetState<AuthProvider[]>;
  setSelectedPlaceId: SetState<string | null>;
  setSelectedFestivalId: SetState<string | null>;
  setFeedNextCursor: SetState<string | null>;
  setFeedHasMore: SetState<boolean>;
  setFeedLoadingMore: SetState<boolean>;
  setMyCommentsNextCursor: SetState<string | null>;
  setMyCommentsHasMore: SetState<boolean>;
  setMyCommentsLoadingMore: SetState<boolean>;
  setMyCommentsLoadedOnce: SetState<boolean>;
  setMyPage: SetState<MyPageResponse | null>;
  setNotice: SetState<string | null>;
  setCurrentPosition: SetState<{ latitude: number; longitude: number } | null>;
  setMapLocationStatus: SetState<MapLocationStatus>;
  setMapLocationMessage: SetState<string | null>;
  setMapLocationFocusKey: SetState<number>;
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
}

function formatDistanceMeters(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function useAppBootstrapActions({
  activeTab,
  resetReviewCaches,
  refreshMyPageForUser,
  goToTab,
  setBootstrapStatus,
  setBootstrapError,
  setPlaces,
  setFestivals,
  setStampState,
  setHasRealData,
  setSessionUser,
  setProviders,
  setSelectedPlaceId,
  setSelectedFestivalId,
  setFeedNextCursor,
  setFeedHasMore,
  setFeedLoadingMore,
  setMyCommentsNextCursor,
  setMyCommentsHasMore,
  setMyCommentsLoadingMore,
  setMyCommentsLoadedOnce,
  setMyPage,
  setNotice,
  setCurrentPosition,
  setMapLocationStatus,
  setMapLocationMessage,
  setMapLocationFocusKey,
}: UseAppBootstrapActionsParams) {
  async function loadApp(withLoading: boolean) {
    const authParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
    const authState = authParams?.get('auth');

    if (withLoading) {
      setBootstrapStatus('loading');
    }
    setBootstrapError(null);

    try {
      const [bootstrap, festivalResult] = await Promise.all([
        getMapBootstrap(),
        getFestivals().catch(() => [] as FestivalItem[]),
      ]);

      setPlaces(bootstrap.places);
      setFestivals(festivalResult);
      setStampState(bootstrap.stamps);
      setHasRealData(bootstrap.hasRealData);
      setSessionUser(bootstrap.auth.user);
      resetReviewCaches();
      setFeedNextCursor(null);
      setFeedHasMore(false);
      setFeedLoadingMore(false);
      setMyCommentsNextCursor(null);
      setMyCommentsHasMore(false);
      setMyCommentsLoadingMore(false);
      setMyCommentsLoadedOnce(false);
      setProviders(bootstrap.auth.providers);
      setSelectedPlaceId((current) => (current && bootstrap.places.some((place) => place.id === current) ? current : null));
      setSelectedFestivalId((current) => (current && festivalResult.some((festival) => festival.id === current) ? current : null));

      if (bootstrap.auth.user) {
        if (activeTab === 'my') {
          await refreshMyPageForUser(bootstrap.auth.user, true);
        }
      } else {
        setMyPage(null);
      }

      setBootstrapStatus('ready');
      if (authState === 'naver-success' && bootstrap.auth.user?.profileCompletedAt === null) {
        goToTab('my');
        setNotice('닉네임을 먼저 정하면 같은 계정으로 스탬프와 피드를 이어갈 수 있어요.');
      }
    } catch (error) {
      setBootstrapError(formatErrorMessage(error));
      setBootstrapStatus('error');
    } finally {
      clearAuthQueryParams();
    }
  }

  async function refreshCurrentPosition(shouldFocusMap: boolean) {
    setMapLocationStatus('loading');
    setMapLocationMessage('현재 위치를 확인하고 있어요.');

    try {
      const nextPosition = await getCurrentDevicePosition();
      setCurrentPosition({ latitude: nextPosition.latitude, longitude: nextPosition.longitude });
      setMapLocationStatus('ready');
      setMapLocationMessage(`현재 위치를 확인했어요. 위치 정확도는 약 ${formatDistanceMeters(nextPosition.accuracyMeters)}예요.`);
      if (shouldFocusMap) {
        setMapLocationFocusKey((current) => current + 1);
      }
    } catch (error) {
      setCurrentPosition(null);
      setMapLocationStatus('error');
      setMapLocationMessage(formatErrorMessage(error));
    }
  }

  function startProviderLogin(provider: 'naver' | 'kakao') {
    window.location.assign(getProviderLoginUrl(provider, getLoginReturnUrl()));
  }

  return {
    loadApp,
    refreshCurrentPosition,
    startProviderLogin,
  };
}
