import { getFestivals, getMapBootstrap, getProviderLoginUrl } from '../api/client';
import { getCurrentDevicePosition } from '../lib/geolocation';
import { clearAuthQueryParams, getLoginReturnUrl } from './useAppRouteState';
import type { AuthProvider, FestivalItem, MyPageResponse, Place, SessionUser, StampState, Tab } from '../types';
import type { Dispatch, SetStateAction } from 'react';

type SetState<T> = Dispatch<SetStateAction<T>>;

type MapLocationStatus = 'idle' | 'loading' | 'ready' | 'error';
type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * useAppBootstrapActions 훅의 의존성 주입을 위한 파라미터 인터페이스입니다.
 * 부트스트랩 데이터 로드 시 초기화해야 할 전역 상태들을 담습니다.
 */
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

/**
 * 에러 객체에서 사용자용 메시지를 추출합니다.
 */
function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
}

/**
 * 미터(m) 단위의 거리를 화면 표시용 문자열(m 또는 km)로 변환합니다.
 */
function formatDistanceMeters(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * 앱이 처음 구동될 때의 필수 데이터 로딩(Bootstrap)과,
 * 디바이스 GPS 좌표 갱신, 로그인 진입 등을 총괄하는 커스텀 훅입니다.
 */
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
  /**
   * 서버로부터 필수 데이터(지도 장소, 행사 목록 등)를 일괄로 불러와(Zustand) 상태를 채웁니다.
   * `withLoading`이 참이면 화면에 로딩 스피너 등을 표시할 수 있도록 `loading` 상태를 세팅합니다.
   * 로그인 리다이렉트에서 돌아왔을 때의 성공(auth=naver-success) 파라미터 처리도 함께 담당합니다.
   */
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

  /**
   * 사용자의 디바이스 GPS를 한 번 더 측정하여 지도나 스탬프 기능에 활용할 현재 위치를 갱신합니다.
   * `shouldFocusMap`이 참이면 지도의 초점을 갱신된 내 위치로 강제 이동시킵니다.
   */
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

  /**
   * 지정된 제공자(provider)의 OAuth 로그인 플로우를 시작(페이지 이동)합니다.
   */
  function startProviderLogin(provider: 'naver' | 'kakao') {
    window.location.assign(getProviderLoginUrl(provider, getLoginReturnUrl()));
  }

  return {
    loadApp,
    refreshCurrentPosition,
    startProviderLogin,
  };
}
