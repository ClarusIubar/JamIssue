import { useEffect } from 'react';
import { formatDistanceMeters } from '../lib/visits';
import type { Place, SessionUser, StampLog } from '../types';

interface UseAppFeedbackEffectsParams {
  selectedPlace: Place | null;
  selectedPlaceDistanceMeters: number | null;
  sessionUser: SessionUser | null;
  todayStamp: StampLog | null;
  notice: string | null;
  mapLocationMessage: string | null;
  stampUnlockRadiusMeters: number;
  noticeDismissDelayMs: number;
  setStampActionMessage: (message: string) => void;
  setNotice: (notice: string | null) => void;
  setMapLocationMessage: (message: string | null) => void;
}

export function useAppFeedbackEffects({
  selectedPlace,
  selectedPlaceDistanceMeters,
  sessionUser,
  todayStamp,
  notice,
  mapLocationMessage,
  stampUnlockRadiusMeters,
  noticeDismissDelayMs,
  setStampActionMessage,
  setNotice,
  setMapLocationMessage,
}: UseAppFeedbackEffectsParams) {
  useEffect(() => {
    if (!selectedPlace) {
      setStampActionMessage('\uC7A5\uC18C\uB97C \uC120\uD0DD\uD558\uBA74 \uC624\uB298 \uC2A4\uD0EC\uD504 \uAC00\uB2A5 \uC5EC\uBD80\uB97C \uBC14\uB85C \uD655\uC778\uD560 \uC218 \uC788\uC5B4\uC694.');
      return;
    }

    if (!sessionUser) {
      setStampActionMessage(`${selectedPlace.name}\uC5D0\uC11C \uC2A4\uD0EC\uD504\uB97C \uCC0D\uC73C\uB824\uBA74 \uBA3C\uC800 \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.`);
      return;
    }

    if (todayStamp) {
      setStampActionMessage(`${todayStamp.visitLabel} \uC624\uB298 \uC2A4\uD0EC\uD504\uB97C \uC774\uBBF8 \uCC0D\uC5C8\uC5B4\uC694.`);
      return;
    }

    if (typeof selectedPlaceDistanceMeters !== 'number') {
      setStampActionMessage('\uD604\uC7AC \uC704\uCE58\uB97C \uD655\uC778\uD558\uBA74 \uC624\uB298 \uC2A4\uD0EC\uD504 \uAC00\uB2A5 \uC5EC\uBD80\uB97C \uBC14\uB85C \uC548\uB0B4\uD574 \uB4DC\uB9B4\uAC8C\uC694.');
      return;
    }

    if (selectedPlaceDistanceMeters <= stampUnlockRadiusMeters) {
      setStampActionMessage(`\uD604\uC7A5 \uBC18\uACBD ${formatDistanceMeters(selectedPlaceDistanceMeters)} \uC548\uC774\uC5D0\uC694. \uC9C0\uAE08 \uBC14\uB85C \uC624\uB298 \uC2A4\uD0EC\uD504\uB97C \uCC0D\uC744 \uC218 \uC788\uC5B4\uC694.`);
      return;
    }

    setStampActionMessage(`\uD604\uC7A5\uAE4C\uC9C0 ${formatDistanceMeters(selectedPlaceDistanceMeters)} \uB0A8\uC544 \uC788\uC5B4\uC694. ${stampUnlockRadiusMeters}m \uC548\uC73C\uB85C \uB4E4\uC5B4\uC624\uBA74 \uC624\uB298 \uC2A4\uD0EC\uD504\uB97C \uCC0D\uC744 \uC218 \uC788\uC5B4\uC694.`);
  }, [
    selectedPlace,
    selectedPlaceDistanceMeters,
    sessionUser,
    todayStamp,
    stampUnlockRadiusMeters,
    setStampActionMessage,
  ]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = setTimeout(() => setNotice(null), noticeDismissDelayMs);
    return () => clearTimeout(timer);
  }, [notice, noticeDismissDelayMs, setNotice]);

  useEffect(() => {
    if (!mapLocationMessage) {
      return;
    }

    const timer = setTimeout(() => setMapLocationMessage(null), noticeDismissDelayMs);
    return () => clearTimeout(timer);
  }, [mapLocationMessage, noticeDismissDelayMs, setMapLocationMessage]);
}
