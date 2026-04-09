import { logout, updateProfile, getProviderLoginUrl } from '../api/client';
import { getLoginReturnUrl } from './useAppRouteState';
import type { Dispatch, SetStateAction } from 'react';
import { useAuthStore } from '../store/auth-store';
import { useAppRuntimeStore } from '../store/app-runtime-store';
import type { MyPageResponse, SessionUser } from '../types';

type SetState<T> = Dispatch<SetStateAction<T>>;

interface ProviderOption {
  key: 'naver' | 'kakao';
  label: string;
  isEnabled: boolean;
  loginUrl: string | null;
}

interface UseAppAuthActionsParams {
  setMyPage: SetState<MyPageResponse | null>;
  formatErrorMessage: (error: unknown) => string;
}

export function useAppAuthActions({
  setMyPage,
  formatErrorMessage,
}: UseAppAuthActionsParams) {
  const setSessionUser = useAuthStore((state) => state.setSessionUser);
  const setProviders = useAuthStore((state) => state.setProviders);
  const setNotice = useAppRuntimeStore((state) => state.setNotice);
  const setIsLoggingOut = useAppRuntimeStore((state) => state.setIsLoggingOut);
  const setProfileSaving = useAppRuntimeStore((state) => state.setProfileSaving);
  const setProfileError = useAppRuntimeStore((state) => state.setProfileError);

  function startProviderLogin(provider: 'naver' | 'kakao') {
    window.location.assign(getProviderLoginUrl(provider, getLoginReturnUrl()));
  }

  async function handleUpdateProfile(nextNickname: string) {
    if (!nextNickname || nextNickname.length < 2) {
      setProfileError('닉네임은 두 글자 이상으로 입력해 주세요.');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    try {
      const auth = await updateProfile({ nickname: nextNickname });
      setSessionUser(auth.user);
      if (auth.user) {
        setMyPage((current) => (current && auth.user ? { ...current, user: auth.user } : current));
      }
      // 프로필 저장 직후 화면에 바로 반영한다.
      setNotice('닉네임을 저장했어요. 이제 같은 계정으로 기록을 이어볼 수 있어요.');
    } catch (error) {
      setProfileError(formatErrorMessage(error));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const auth = await logout();
      setSessionUser(auth.user);
      setProviders(auth.providers);
      setMyPage(null);
      setNotice('로그아웃했어요.');
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setIsLoggingOut(false);
    }
  }

  return {
    startProviderLogin,
    handleUpdateProfile,
    handleLogout,
  };
}
