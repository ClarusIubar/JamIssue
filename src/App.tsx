import { useState } from 'react';
import { AppMapStageView } from './components/AppMapStageView';
import { AppPageStage } from './components/AppPageStage';
import { BottomNav } from './components/BottomNav';
import { GlobalFeedbackButton } from './components/GlobalFeedbackButton';
import { FloatingBackButton } from './components/FloatingBackButton';
import { GlobalNotificationCenter } from './components/GlobalNotificationCenter';
import { GlobalStatusBanner } from './components/GlobalStatusBanner';
import {
  useAppRouteState,
  getInitialMapViewport,
  updateMapViewportInUrl,
} from './hooks/useAppRouteState';
import { useAppDataState } from './hooks/useAppDataState';
import { useAppPageRuntimeState } from './hooks/useAppPageRuntimeState';
import { useAppShellRuntimeState } from './hooks/useAppShellRuntimeState';
import { useAppShellCoordinator } from './hooks/useAppShellCoordinator';
import { useAppStageProps } from './hooks/useAppStageProps';
import { useAuthDomainState } from './hooks/useAuthDomainState';
import { useMapDomainState } from './hooks/useMapDomainState';
import { useMyPageDomainState } from './hooks/useMyPageDomainState';
import { useReturnViewDomainState } from './hooks/useReturnViewDomainState';
import { useReviewDomainState } from './hooks/useReviewDomainState';
import type { Tab } from './types';

export default function App() {
  const routeState = useAppRouteState();

  const [initialMapViewport] = useState(getInitialMapViewport);

  const domainState = {
    auth: useAuthDomainState(),
    map: useMapDomainState(),
    myPage: useMyPageDomainState(),
    returnView: useReturnViewDomainState(),
    review: useReviewDomainState(),
  };

  const shellRuntimeState = useAppShellRuntimeState();
  const pageRuntimeState = useAppPageRuntimeState();
  const dataState = useAppDataState(routeState.selectedPlaceId);
  const coordinator = useAppShellCoordinator({
    routeState,
    domainState,
    shellRuntimeState,
    pageRuntimeState,
    dataState,
    initialMapViewport,
  });
  const {
    activeTab,
    canNavigateBack,
    handleNavigateBack,
    handleBottomNavChange,
    globalStatus,
    hydratedMyPage,
    sessionUser,
    handleOpenGlobalNotification,
    handleMarkAllNotificationsRead,
    handleDeleteNotification,
    mapStageProps,
    pageStageProps,
  } = useAppStageProps(coordinator);
  return (
    <div className="map-app-shell">
      <div className={[
        'phone-shell',
        activeTab === 'map' ? 'phone-shell--map' : '',
      ].filter(Boolean).join(' ')}>
        {globalStatus && (
          <div className="phone-shell__status-slot">
            <GlobalStatusBanner tone={globalStatus.tone} message={globalStatus.message} layout={activeTab === 'map' ? 'map' : 'page'} />
          </div>
        )}
        <div className="phone-shell__utility-slot">
          <GlobalFeedbackButton />
          {sessionUser && hydratedMyPage && (
            <GlobalNotificationCenter
              sessionUserName={sessionUser.nickname}
              notifications={hydratedMyPage.notifications}
              unreadCount={hydratedMyPage.unreadNotificationCount}
              onOpenNotification={handleOpenGlobalNotification}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              onDeleteNotification={handleDeleteNotification}
            />
          )}
        </div>
        <div className="phone-shell__body">
          {activeTab === 'map' ? (
            <AppMapStageView {...mapStageProps} />
          ) : (
            <AppPageStage {...pageStageProps} />
          )}

          {canNavigateBack && <FloatingBackButton onNavigateBack={handleNavigateBack} />}

          <BottomNav activeTab={activeTab} onChange={handleBottomNavChange} />
        </div>
      </div>
    </div>
  );
}
