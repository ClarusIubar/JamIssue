import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { RoadmapBannerPreview } from './components/RoadmapBannerPreview';
import './index.css';
import './styles/refinements.css';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

/**
 * 모바일 브라우저(특히 사파리 등)의 동적인 주소표시줄 영역을 고려하여
 * 실제 가시 영역(Viewport) 크기 변수를 CSS 변수(`--app-height`, `--app-width`)로 지속 업데이트하는 함수입니다.
 */
function syncViewportMetrics() {
  if (typeof window === 'undefined') {
    return;
  }

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  document.documentElement.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);
  document.documentElement.style.setProperty('--app-width', `${Math.round(viewportWidth)}px`);
}

if (typeof window !== 'undefined') {
  syncViewportMetrics();
  window.addEventListener('resize', syncViewportMetrics, { passive: true });
  window.addEventListener('orientationchange', syncViewportMetrics, { passive: true });
  window.visualViewport?.addEventListener('resize', syncViewportMetrics, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncViewportMetrics, { passive: true });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('루트 노드를 찾을 수 없어요.');
}

/**
 * URL에 포함된 특별한 매개변수(`preview=roadmap-banner`)를 감지하여
 * 일반적인 App 진입점이 아닌, 독립된 로드맵 배너 프리뷰 화면으로 컴포넌트를 분기하여 렌더링합니다.
 */
function resolveEntry() {
  if (typeof window === 'undefined') {
    return <App />;
  }

  const preview = new URLSearchParams(window.location.search).get('preview');
  if (preview === 'roadmap-banner') {
    return <RoadmapBannerPreview />;
  }

  return <App />;
}

createRoot(rootElement).render(
  <StrictMode>
    {resolveEntry()}
  </StrictMode>,
);

