import type { Dispatch, SetStateAction } from 'react';
import { claimStamp } from '../api/client';
import { getCurrentDevicePosition } from '../lib/geolocation';
import { formatDistanceMeters } from '../lib/visits';
import type { ApiStatus, DrawerState, Place, SessionUser, StampState, Tab } from '../types';

type HistoryMode = 'push' | 'replace';
type SetState<T> = Dispatch<SetStateAction<T>>;

interface UseAppMapActionsParams {
  sessionUser: SessionUser | null;
  setPlaces: SetState<Place[]>;
  setCurrentPosition: SetState<{ latitude: number; longitude: number } | null>;
  setMapLocationStatus: SetState<ApiStatus>;
  setMapLocationMessage: SetState<string | null>;
  setMapLocationFocusKey: SetState<number>;
  setNotice: (notice: string | null) => void;
  setStampState: SetState<StampState>;
  setStampActionStatus: SetState<ApiStatus>;
  goToTab: (nextTab: Tab, historyMode?: HistoryMode) => void;
  commitRouteState: (
    nextState: { tab: Tab; placeId: string | null; festivalId: string | null; drawerState: DrawerState },
    historyMode?: HistoryMode,
  ) => void;
  refreshMyPageForUser: (user: SessionUser | null, force?: boolean) => Promise<unknown>;
  formatErrorMessage: (error: unknown) => string;
}

export function useAppMapActions({
  sessionUser,
  setPlaces,
  setCurrentPosition,
  setMapLocationStatus,
  setMapLocationMessage,
  setMapLocationFocusKey,
  setNotice,
  setStampState,
  setStampActionStatus,
  goToTab,
  commitRouteState,
  refreshMyPageForUser,
  formatErrorMessage,
}: UseAppMapActionsParams) {
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

  async function handleClaimStamp(place: Place) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('로그인하면 스탬프를 찍고 피드도 남길 수 있어요.');
      return;
    }

    setStampActionStatus('loading');
    try {
      const nextPosition = await getCurrentDevicePosition();
      setCurrentPosition({ latitude: nextPosition.latitude, longitude: nextPosition.longitude });
      const nextStampState = await claimStamp({
        placeId: place.id,
        latitude: nextPosition.latitude,
        longitude: nextPosition.longitude,
      });
      // 스탬프 성공 후 지도 상태와 마이페이지를 함께 맞춘다.
      setStampState(nextStampState);
      setPlaces((current) => current.map((item) => (
        item.id === place.id
          ? { ...item, totalVisitCount: (item.totalVisitCount ?? 0) + 1 }
          : item
      )));
      setNotice(`${place.name}에서 오늘 스탬프를 찍었어요.`);
      commitRouteState(
        {
          tab: 'map',
          placeId: place.id,
          festivalId: null,
          drawerState: 'full',
        },
        'replace',
      );
      await refreshMyPageForUser(sessionUser);
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setStampActionStatus('ready');
    }
  }

  return {
    refreshCurrentPosition,
    handleClaimStamp,
  };
}
