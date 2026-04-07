import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAppStageActions } from '../../src/hooks/useAppStageActions';
import { placeFixture, routeFixture, sessionUserFixture } from '../fixtures/app-fixtures';

describe('useAppStageActions', () => {
  it('clears route preview when opening a place directly from the map', () => {
    const setSelectedRoutePreview = vi.fn();
    const commitRouteState = vi.fn();

    const { result } = renderHook(() => useAppStageActions({
      selectedPlace: placeFixture,
      selectedFestival: null,
      selectedPlaceId: placeFixture.id,
      selectedFestivalId: null,
      drawerState: 'partial',
      selectedRoutePreview: {
        id: routeFixture.id,
        title: routeFixture.title,
        subtitle: `${routeFixture.author} / ${routeFixture.createdAt}`,
        mood: routeFixture.mood,
        placeIds: routeFixture.placeIds,
        placeNames: routeFixture.placeNames,
      },
      sessionUser: sessionUserFixture,
      setSelectedRoutePreview,
      setFeedPlaceFilterId: vi.fn(),
      setCommunityRouteSort: vi.fn(),
      commitRouteState,
      goToTab: vi.fn(),
      handleOpenPlaceFeedWithReturn: vi.fn(),
      handleOpenCommentWithReturn: vi.fn(),
      refreshCurrentPosition: vi.fn().mockResolvedValue(undefined),
      fetchCommunityRoutes: vi.fn().mockResolvedValue(undefined),
      refreshMyPageForUser: vi.fn().mockResolvedValue(undefined),
      reportBackgroundError: vi.fn(),
    }));

    act(() => {
      result.current.handleMapOpenPlace('place-2');
    });

    expect(setSelectedRoutePreview).toHaveBeenCalledWith(null);
    expect(commitRouteState).toHaveBeenCalledWith(
      { tab: 'map', placeId: 'place-2', festivalId: null, drawerState: 'partial' },
      'push',
      { routePreview: null },
    );
  });

  it('preserves the active route preview when opening a place from the route preview card', () => {
    const selectedRoutePreview = {
      id: routeFixture.id,
      title: routeFixture.title,
      subtitle: `${routeFixture.author} / ${routeFixture.createdAt}`,
      mood: routeFixture.mood,
      placeIds: routeFixture.placeIds,
      placeNames: routeFixture.placeNames,
    };
    const commitRouteState = vi.fn();

    const { result } = renderHook(() => useAppStageActions({
      selectedPlace: placeFixture,
      selectedFestival: null,
      selectedPlaceId: placeFixture.id,
      selectedFestivalId: null,
      drawerState: 'partial',
      selectedRoutePreview,
      sessionUser: sessionUserFixture,
      setSelectedRoutePreview: vi.fn(),
      setFeedPlaceFilterId: vi.fn(),
      setCommunityRouteSort: vi.fn(),
      commitRouteState,
      goToTab: vi.fn(),
      handleOpenPlaceFeedWithReturn: vi.fn(),
      handleOpenCommentWithReturn: vi.fn(),
      refreshCurrentPosition: vi.fn().mockResolvedValue(undefined),
      fetchCommunityRoutes: vi.fn().mockResolvedValue(undefined),
      refreshMyPageForUser: vi.fn().mockResolvedValue(undefined),
      reportBackgroundError: vi.fn(),
    }));

    act(() => {
      result.current.handleMapOpenRoutePreviewPlace('place-2');
    });

    expect(commitRouteState).toHaveBeenCalledWith(
      { tab: 'map', placeId: 'place-2', festivalId: null, drawerState: 'partial' },
      'push',
      { routePreview: selectedRoutePreview },
    );
  });

  it('retries my-page only when a session user exists', async () => {
    const refreshMyPageForUser = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ sessionUser }) => useAppStageActions({
        selectedPlace: placeFixture,
        selectedFestival: null,
        selectedPlaceId: placeFixture.id,
        selectedFestivalId: null,
        drawerState: 'partial',
        selectedRoutePreview: null,
        sessionUser,
        setSelectedRoutePreview: vi.fn(),
        setFeedPlaceFilterId: vi.fn(),
        setCommunityRouteSort: vi.fn(),
        commitRouteState: vi.fn(),
        goToTab: vi.fn(),
        handleOpenPlaceFeedWithReturn: vi.fn(),
        handleOpenCommentWithReturn: vi.fn(),
        refreshCurrentPosition: vi.fn().mockResolvedValue(undefined),
        fetchCommunityRoutes: vi.fn().mockResolvedValue(undefined),
        refreshMyPageForUser,
        reportBackgroundError: vi.fn(),
      }),
      { initialProps: { sessionUser: null as typeof sessionUserFixture | null } },
    );

    await act(async () => {
      await result.current.handleRetryMyPage();
    });
    expect(refreshMyPageForUser).not.toHaveBeenCalled();

    rerender({ sessionUser: sessionUserFixture });
    await act(async () => {
      await result.current.handleRetryMyPage();
    });
    expect(refreshMyPageForUser).toHaveBeenCalledWith(sessionUserFixture, true);
  });

  it('reports background errors when route sorting refresh fails', async () => {
    const reportBackgroundError = vi.fn();
    const fetchCommunityRoutes = vi.fn().mockRejectedValue(new Error('boom'));
    const setCommunityRouteSort = vi.fn();

    const { result } = renderHook(() => useAppStageActions({
      selectedPlace: placeFixture,
      selectedFestival: null,
      selectedPlaceId: placeFixture.id,
      selectedFestivalId: null,
      drawerState: 'partial',
      selectedRoutePreview: null,
      sessionUser: sessionUserFixture,
      setSelectedRoutePreview: vi.fn(),
      setFeedPlaceFilterId: vi.fn(),
      setCommunityRouteSort,
      commitRouteState: vi.fn(),
      goToTab: vi.fn(),
      handleOpenPlaceFeedWithReturn: vi.fn(),
      handleOpenCommentWithReturn: vi.fn(),
      refreshCurrentPosition: vi.fn().mockResolvedValue(undefined),
      fetchCommunityRoutes,
      refreshMyPageForUser: vi.fn().mockResolvedValue(undefined),
      reportBackgroundError,
    }));

    await act(async () => {
      result.current.handleChangeRouteSort('latest');
      await Promise.resolve();
    });

    expect(setCommunityRouteSort).toHaveBeenCalledWith('latest');
    expect(reportBackgroundError).toHaveBeenCalled();
  });
});
