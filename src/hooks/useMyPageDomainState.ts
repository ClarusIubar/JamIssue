import { useMyPageStore } from '../store/my-page-store';

export function useMyPageDomainState() {
  const myPageTab = useMyPageStore((state) => state.myPageTab);
  const setMyPageTab = useMyPageStore((state) => state.setMyPageTab);

  return {
    myPageTab,
    setMyPageTab,
  };
}
