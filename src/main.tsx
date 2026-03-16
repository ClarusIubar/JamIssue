import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { RoadmapBannerPreview } from './components/RoadmapBannerPreview';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('루트 노드를 찾지 못했어요.');
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
