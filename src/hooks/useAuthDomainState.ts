import { useAuthStore } from '../store/auth-store';

export function useAuthDomainState() {
  const sessionUser = useAuthStore((state) => state.sessionUser);
  const providers = useAuthStore((state) => state.providers);

  return {
    sessionUser,
    providers,
  };
}
