import { create } from 'zustand';
import type { MyPageTabKey } from '../types';
import { resolveValue, type SetterValue } from './store-utils';

type MyPageStoreState = {
  myPageTab: MyPageTabKey;
  setMyPageTab: (value: SetterValue<MyPageTabKey>) => void;
};

export const useMyPageStore = create<MyPageStoreState>((set) => ({
  myPageTab: 'stamps',
  setMyPageTab: (value) => set((state) => ({ myPageTab: resolveValue(value, state.myPageTab) })),
}));
