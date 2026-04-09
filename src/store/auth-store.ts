import { create } from 'zustand';
import type { AuthProvider, SessionUser } from '../types';
import { resolveValue, type SetterValue } from './store-utils';

const emptyProviders: AuthProvider[] = [
  { key: 'naver', label: '네이버', isEnabled: false, loginUrl: null },
  { key: 'kakao', label: '카카오', isEnabled: false, loginUrl: null },
];

type AuthStoreState = {
  sessionUser: SessionUser | null;
  providers: AuthProvider[];
  setSessionUser: (value: SetterValue<SessionUser | null>) => void;
  setProviders: (value: SetterValue<AuthProvider[]>) => void;
};

export const useAuthStore = create<AuthStoreState>((set) => ({
  sessionUser: null,
  providers: emptyProviders,
  setSessionUser: (value) => set((state) => ({ sessionUser: resolveValue(value, state.sessionUser) })),
  setProviders: (value) => set((state) => ({ providers: resolveValue(value, state.providers) })),
}));
