import type { Dispatch, SetStateAction } from 'react';
import { getFestivals, getMapBootstrap, importPublicData, updatePlaceVisibility } from '../api/client';
import { useAppShellRuntimeStore } from '../store/app-shell-runtime-store';
import type {
  AdminSummaryResponse,
  FestivalItem,
  Place,
  SessionUser,
  StampState,
} from '../types';

type SetState<T> = Dispatch<SetStateAction<T>>;

interface UseAppAdminActionsParams {
  sessionUser: SessionUser | null;
  setAdminBusyPlaceId: SetState<string | null>;
  setAdminSummary: SetState<AdminSummaryResponse | null>;
  setPlaces: SetState<Place[]>;
  setStampState: SetState<StampState>;
  setHasRealData: SetState<boolean>;
  setAdminLoading: SetState<boolean>;
  setFestivals: SetState<FestivalItem[]>;
  refreshAdminSummary: (force?: boolean) => Promise<AdminSummaryResponse | null>;
  formatErrorMessage: (error: unknown) => string;
}

export function useAppAdminActions({
  sessionUser,
  setAdminBusyPlaceId,
  setAdminSummary,
  setPlaces,
  setStampState,
  setHasRealData,
  setAdminLoading,
  setFestivals,
  refreshAdminSummary,
  formatErrorMessage,
}: UseAppAdminActionsParams) {
  const setNotice = useAppShellRuntimeStore((state) => state.setNotice);

  async function handleToggleAdminPlace(placeId: string, nextValue: boolean) {
    if (!sessionUser?.isAdmin) {
      return;
    }

    setAdminBusyPlaceId(placeId);
    try {
      const updated = await updatePlaceVisibility(placeId, { isActive: nextValue });
      setAdminSummary((current) => current ? {
        ...current,
        places: current.places.map((place) => place.id === placeId ? updated : place),
      } : current);
      const nextMap = await getMapBootstrap();
      setPlaces(nextMap.places);
      setStampState(nextMap.stamps);
      setHasRealData(nextMap.hasRealData);
      setNotice(nextValue ? '장소 노출을 켜두었어요.' : '장소 노출을 숨겼어요.');
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setAdminBusyPlaceId(null);
    }
  }

  async function handleToggleAdminManualOverride(placeId: string, nextValue: boolean) {
    if (!sessionUser?.isAdmin) {
      return;
    }

    setAdminBusyPlaceId(placeId);
    try {
      const updated = await updatePlaceVisibility(placeId, { isManualOverride: nextValue });
      setAdminSummary((current) => current ? {
        ...current,
        places: current.places.map((place) => place.id === placeId ? updated : place),
      } : current);
      setNotice(nextValue ? '공공데이터 자동 동기화에서 보호해둘게요.' : '공공데이터 자동 동기화 보호를 해제했어요.');
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setAdminBusyPlaceId(null);
    }
  }

  async function handleRefreshAdminImport() {
    if (!sessionUser?.isAdmin) {
      return;
    }

    setAdminLoading(true);
    try {
      await importPublicData();
      const [nextSummary, nextMap] = await Promise.all([
        refreshAdminSummary(true),
        getMapBootstrap(),
      ]);
      if (nextSummary) {
        setAdminSummary(nextSummary);
      }
      // import 이후 관리자 화면과 지도 데이터를 같은 시점으로 맞춘다.
      setPlaces(nextMap.places);
      setStampState(nextMap.stamps);
      setHasRealData(nextMap.hasRealData);
      setNotice('행사 데이터를 다시 불러왔어요.');
      void getFestivals()
        .then((nextFestivals) => {
          setFestivals(nextFestivals);
        })
        .catch(() => {
          // 축제 동기화 실패는 관리자 import 완료 상태를 막지 않는다.
        });
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setAdminLoading(false);
    }
  }

  return {
    handleToggleAdminPlace,
    handleToggleAdminManualOverride,
    handleRefreshAdminImport,
  };
}
