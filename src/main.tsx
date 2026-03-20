import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { RoadmapBannerPreview } from './components/RoadmapBannerPreview';
import './index.css';
import './styles/refinements.css';

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

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

