import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { createUserRoute, toggleCommunityRouteLike } from '../api/client';
import type { MyPageResponse, MyPageTabKey, SessionUser, Tab, UserRoute } from '../types';

type SetState<T> = Dispatch<SetStateAction<T>>;
type CommunityRoutesCache = Partial<Record<'popular' | 'latest', UserRoute[]>>;
type HistoryMode = 'push' | 'replace';

interface UseAppRouteActionsParams {
  sessionUser: SessionUser | null;
  setRouteLikeUpdatingId: SetState<string | null>;
  setRouteSubmitting: SetState<boolean>;
  setRouteError: SetState<string | null>;
  setMyPage: SetState<MyPageResponse | null>;
  setNotice: (notice: string | null) => void;
  setMyPageTab: (nextTab: MyPageTabKey) => void;
  communityRoutesCacheRef: MutableRefObject<CommunityRoutesCache>;
  patchCommunityRoutes: (routeId: string, updater: (route: UserRoute) => UserRoute) => void;
  refreshMyPageForUser: (user: SessionUser | null, force?: boolean) => Promise<MyPageResponse | null>;
  formatErrorMessage: (error: unknown) => string;
  goToTab: (nextTab: Tab, historyMode?: HistoryMode) => void;
}

export function useAppRouteActions({
  sessionUser,
  setRouteLikeUpdatingId,
  setRouteSubmitting,
  setRouteError,
  setMyPage,
  setNotice,
  setMyPageTab,
  communityRoutesCacheRef,
  patchCommunityRoutes,
  refreshMyPageForUser,
  formatErrorMessage,
  goToTab,
}: UseAppRouteActionsParams) {
  async function handleToggleRouteLike(routeId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('좋아요를 누르려면 먼저 로그인해 주세요.');
      return;
    }

    setRouteLikeUpdatingId(routeId);
    try {
      const result = await toggleCommunityRouteLike(routeId);
      patchCommunityRoutes(routeId, (route) => ({
        ...route,
        likeCount: result.likeCount,
        likedByMe: result.likedByMe,
      }));
      setMyPage((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          routes: current.routes.map((route) =>
            route.id === routeId
              ? {
                  ...route,
                  likeCount: result.likeCount,
                  likedByMe: result.likedByMe,
                }
              : route,
          ),
        };
      });
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setRouteLikeUpdatingId(null);
    }
  }

  async function handlePublishRoute(payload: { travelSessionId: string; title: string; description: string; mood: string }) {
    if (!sessionUser) {
      goToTab('my');
      setRouteError('로그인하면 여행 세션을 코스로 발행할 수 있어요.');
      return;
    }

    setRouteSubmitting(true);
    setRouteError(null);
    try {
      const createdRoute = await createUserRoute({
        travelSessionId: payload.travelSessionId,
        title: payload.title,
        description: payload.description,
        mood: payload.mood,
        isPublic: true,
      });
      // 발행 직후 공개 경로 목록이 최신 상태를 보도록 캐시를 갱신한다.
      communityRoutesCacheRef.current = {
        ...communityRoutesCacheRef.current,
        latest: [createdRoute, ...(communityRoutesCacheRef.current.latest ?? []).filter((route) => route.id !== createdRoute.id)],
      };
      delete communityRoutesCacheRef.current.popular;
      setMyPage((current) => {
        if (!current) {
          return current;
        }
        const routeExists = current.routes.some((route) => route.id === createdRoute.id);
        return {
          ...current,
          routes: [createdRoute, ...current.routes.filter((route) => route.id !== createdRoute.id)],
          travelSessions: current.travelSessions.map((session) =>
            session.id === payload.travelSessionId ? { ...session, publishedRouteId: createdRoute.id } : session,
          ),
          stats: {
            ...current.stats,
            routeCount: routeExists ? current.stats.routeCount : current.stats.routeCount + 1,
          },
        };
      });
      setNotice('코스를 발행했어요. 공개 경로 탭에서 바로 확인할 수 있어요.');
      setMyPageTab('routes');
      await refreshMyPageForUser(sessionUser, true);
    } catch (error) {
      setRouteError(formatErrorMessage(error));
    } finally {
      setRouteSubmitting(false);
    }
  }

  return {
    handleToggleRouteLike,
    handlePublishRoute,
  };
}
