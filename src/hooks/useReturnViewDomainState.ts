import { useAppUIStore } from '../store/app-ui-store';

export function useReturnViewDomainState() {
  const returnView = useAppUIStore((state) => state.returnView);
  const setReturnView = useAppUIStore((state) => state.setReturnView);

  return {
    returnView,
    setReturnView,
  };
}
