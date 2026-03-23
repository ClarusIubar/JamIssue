import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  claimStamp,
  createComment,
  createReview,
  createUserRoute,
  deleteComment,
  deleteReview,
  getFestivals,
  getMapBootstrap,
  importPublicData,
  logout,
  toggleCommunityRouteLike,
  toggleReviewLike,
  updateComment,
  updatePlaceVisibility,
  updateProfile,
  uploadReviewImage,
} from '../api/client';
import { getCurrentDevicePosition } from '../lib/geolocation';
import type {
  AdminSummaryResponse,
  DrawerState,
  FestivalItem,
  MyPageResponse,
  MyPageTabKey,
  Place,
  Review,
  ReviewMood,
  SessionUser,
  StampState,
  Tab,
  UserRoute,
} from '../types';

type SetState<T> = Dispatch<SetStateAction<T>>;
type HistoryMode = 'push' | 'replace';
type CommunityRoutesCache = Partial<Record<'popular' | 'latest', UserRoute[]>>;

interface UseAppMutationActionsParams {
  activeTab: Tab;
  sessionUser: SessionUser | null;
  selectedPlace: Place | null;
  selectedPlaceId: string | null;
  selectedFestivalId: string | null;
  drawerState: DrawerState;
  myPageTab: MyPageTabKey;
  feedPlaceFilterId: string | null;
  activeCommentReviewId: string | null;
  highlightedCommentId: string | null;
  highlightedReviewId: string | null;
  setHighlightedReviewId: (reviewId: string | null) => void;
  setCommentSubmittingReviewId: SetState<string | null>;
  setCommentMutatingId: SetState<string | null>;
  setDeletingReviewId: SetState<string | null>;
  setReviewLikeUpdatingId: SetState<string | null>;
  setReviewSubmitting: SetState<boolean>;
  setReviewError: SetState<string | null>;
  setNotice: (notice: string | null) => void;
  setCurrentPosition: SetState<{ latitude: number; longitude: number } | null>;
  setStampState: SetState<StampState>;
  setStampActionStatus: SetState<'idle' | 'loading' | 'ready' | 'error'>;
  refreshMyPageForUser: (user: SessionUser | null, force?: boolean) => Promise<MyPageResponse | null>;
  commitRouteState: (
    nextState: { tab: Tab; placeId: string | null; festivalId: string | null; drawerState: DrawerState },
    historyMode?: HistoryMode,
  ) => void;
  goToTab: (nextTab: Tab, historyMode?: HistoryMode) => void;
  patchReviewCollections: (reviewId: string, updater: (review: Review) => Review) => void;
  upsertReviewCollections: (review: Review) => void;
  setReviews: SetState<Review[]>;
  setSelectedPlaceReviews: SetState<Review[]>;
  placeReviewsCacheRef: MutableRefObject<Record<string, Review[]>>;
  setMyPage: SetState<MyPageResponse | null>;
  handleCloseReviewComments: () => void;
  patchCommunityRoutes: (routeId: string, updater: (route: UserRoute) => UserRoute) => void;
  setRouteLikeUpdatingId: SetState<string | null>;
  setRouteSubmitting: SetState<boolean>;
  setRouteError: SetState<string | null>;
  communityRoutesCacheRef: MutableRefObject<CommunityRoutesCache>;
  setMyPageTab: (nextTab: MyPageTabKey) => void;
  setAdminBusyPlaceId: SetState<string | null>;
  setAdminSummary: SetState<AdminSummaryResponse | null>;
  setPlaces: SetState<Place[]>;
  setHasRealData: SetState<boolean>;
  setFestivals: SetState<FestivalItem[]>;
  refreshAdminSummary: (force?: boolean) => Promise<AdminSummaryResponse | null>;
  setAdminLoading: SetState<boolean>;
  setProfileSaving: SetState<boolean>;
  setProfileError: SetState<string | null>;
  setSessionUser: SetState<SessionUser | null>;
  setProviders: SetState<{ key: 'naver' | 'kakao'; label: string; isEnabled: boolean; loginUrl: string | null }[]>;
  setIsLoggingOut: SetState<boolean>;
}

export function useAppMutationActions({
  activeTab,
  sessionUser,
  selectedPlace,
  selectedPlaceId,
  selectedFestivalId,
  drawerState,
  myPageTab,
  feedPlaceFilterId,
  activeCommentReviewId,
  highlightedCommentId,
  highlightedReviewId,
  setHighlightedReviewId,
  setCommentSubmittingReviewId,
  setCommentMutatingId,
  setDeletingReviewId,
  setReviewLikeUpdatingId,
  setReviewSubmitting,
  setReviewError,
  setNotice,
  setCurrentPosition,
  setStampState,
  setStampActionStatus,
  refreshMyPageForUser,
  commitRouteState,
  goToTab,
  patchReviewCollections,
  upsertReviewCollections,
  setReviews,
  setSelectedPlaceReviews,
  placeReviewsCacheRef,
  setMyPage,
  handleCloseReviewComments,
  patchCommunityRoutes,
  setRouteLikeUpdatingId,
  setRouteSubmitting,
  setRouteError,
  communityRoutesCacheRef,
  setMyPageTab,
  setAdminBusyPlaceId,
  setAdminSummary,
  setPlaces,
  setHasRealData,
  setFestivals,
  refreshAdminSummary,
  setAdminLoading,
  setProfileSaving,
  setProfileError,
  setSessionUser,
  setProviders,
  setIsLoggingOut,
}: UseAppMutationActionsParams) {
  function formatErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return '요청을 처리하지 못했어요. 잠시 뒤에 다시 시도해 주세요.';
  }

  async function handleClaimStamp(place: Place) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('로그인하면 스탬프를 찍고 피드를 남길 수 있어요.');
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
      setStampState(nextStampState);
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

  async function handleCreateReview(payload: { stampId: string; body: string; mood: ReviewMood; file: File | null }) {
    if (!sessionUser || !selectedPlace) {
      goToTab('my');
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);
    try {
      let imageUrl: string | null = null;
      if (payload.file) {
        const uploaded = await uploadReviewImage(payload.file);
        imageUrl = uploaded.url;
      }
      const createdReview = await createReview({
        placeId: selectedPlace.id,
        stampId: payload.stampId,
        body: payload.body.trim(),
        mood: payload.mood,
        imageUrl,
      });
      upsertReviewCollections(createdReview);
      await refreshMyPageForUser(sessionUser);
      setNotice('피드를 남겼어요. 이제 다른 장소도 둘러보세요.');
      commitRouteState(
        {
          tab: 'map',
          placeId: selectedPlace.id,
          festivalId: null,
          drawerState: 'full',
        },
        'replace',
      );
    } catch (error) {
      setReviewError(formatErrorMessage(error));
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleCreateComment(reviewId: string, body: string, parentId?: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('댓글을 남기려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentSubmittingReviewId(reviewId);
    try {
      const updatedComments = await createComment(reviewId, { body, parentId: parentId ?? null });
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        comments: updatedComments,
        commentCount: updatedComments.length,
      }));
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentSubmittingReviewId(null);
    }
  }

  async function handleUpdateComment(reviewId: string, commentId: string, body: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('댓글을 수정하려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentMutatingId(commentId);
    try {
      const updatedComments = await updateComment(reviewId, commentId, { body });
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        comments: updatedComments,
        commentCount: updatedComments.length,
      }));
      if (activeTab === 'my') {
        await refreshMyPageForUser(sessionUser, true);
      }
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentMutatingId(null);
    }
  }

  async function handleDeleteComment(reviewId: string, commentId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('댓글을 삭제하려면 먼저 로그인해 주세요.');
      return;
    }

    setCommentMutatingId(commentId);
    try {
      const updatedComments = await deleteComment(reviewId, commentId);
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        comments: updatedComments,
        commentCount: updatedComments.length,
      }));
      if (activeTab === 'my') {
        await refreshMyPageForUser(sessionUser, true);
      }
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setCommentMutatingId(null);
    }
  }

  async function handleDeleteReview(reviewId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('피드를 삭제하려면 먼저 로그인해 주세요.');
      return;
    }
    if (!window.confirm('이 피드를 삭제할까요?')) {
      return;
    }

    setDeletingReviewId(reviewId);
    try {
      await deleteReview(reviewId);
      setReviews((current) => current.filter((review) => review.id !== reviewId));
      setSelectedPlaceReviews((current) => current.filter((review) => review.id !== reviewId));
      for (const placeId of Object.keys(placeReviewsCacheRef.current)) {
        placeReviewsCacheRef.current[placeId] = placeReviewsCacheRef.current[placeId].filter((review) => review.id !== reviewId);
      }
      setMyPage((current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          reviews: current.reviews.filter((review) => review.id !== reviewId),
          comments: current.comments.filter((comment) => comment.reviewId !== reviewId),
          stats: {
            ...current.stats,
            reviewCount: Math.max(0, current.stats.reviewCount - 1),
          },
        };
      });
      if (activeCommentReviewId === reviewId) {
        handleCloseReviewComments();
      }
      if (highlightedReviewId === reviewId) {
        setHighlightedReviewId(null);
      }
      setNotice('피드를 삭제했어요.');
      if (activeTab === 'my') {
        await refreshMyPageForUser(sessionUser, true);
      }
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setDeletingReviewId(null);
    }
  }

  async function handleToggleReviewLike(reviewId: string) {
    if (!sessionUser) {
      goToTab('my');
      setNotice('좋아요를 누르려면 먼저 로그인해 주세요.');
      return;
    }

    setReviewLikeUpdatingId(reviewId);
    try {
      const result = await toggleReviewLike(reviewId);
      patchReviewCollections(reviewId, (review) => ({
        ...review,
        likeCount: result.likeCount,
        likedByMe: result.likedByMe,
      }));
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setReviewLikeUpdatingId(null);
    }
  }

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
    } catch (error) {
      setRouteError(formatErrorMessage(error));
    } finally {
      setRouteSubmitting(false);
    }
  }

  async function handleToggleAdminPlace(placeId: string, nextValue: boolean) {
    if (!sessionUser?.isAdmin) {
      return;
    }
    setAdminBusyPlaceId(placeId);
    try {
      const updated = await updatePlaceVisibility(placeId, { isActive: nextValue });
      setAdminSummary((current) =>
        current
          ? {
              ...current,
              places: current.places.map((place) => (place.id === placeId ? updated : place)),
            }
          : current,
      );
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
      setAdminSummary((current) =>
        current
          ? {
              ...current,
              places: current.places.map((place) => (place.id === placeId ? updated : place)),
            }
          : current,
      );
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
      const [nextSummary, nextMap, nextFestivals] = await Promise.all([
        refreshAdminSummary(true),
        getMapBootstrap(),
        getFestivals(),
      ]);
      if (nextSummary) {
        setAdminSummary(nextSummary);
      }
      setPlaces(nextMap.places);
      setStampState(nextMap.stamps);
      setHasRealData(nextMap.hasRealData);
      setFestivals(nextFestivals);
      setNotice('행사 데이터를 다시 불러왔어요.');
    } catch (error) {
      setNotice(formatErrorMessage(error));
    } finally {
      setAdminLoading(false);
    }
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
    handleClaimStamp,
    handleCreateReview,
    handleCreateComment,
    handleUpdateComment,
    handleDeleteComment,
    handleDeleteReview,
    handleToggleReviewLike,
    handleToggleRouteLike,
    handlePublishRoute,
    handleToggleAdminPlace,
    handleToggleAdminManualOverride,
    handleRefreshAdminImport,
    handleUpdateProfile,
    handleLogout,
  };
}
