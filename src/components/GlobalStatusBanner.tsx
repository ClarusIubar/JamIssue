interface GlobalStatusBannerProps {
  tone: 'info' | 'error';
  message: string;
  layout: 'map' | 'page';
}

export function GlobalStatusBanner({ tone, message, layout }: GlobalStatusBannerProps) {
  return (
    <section
      className={[
        'global-status-banner',
        `global-status-banner--${layout}`,
        tone === 'error' ? 'global-status-banner--error' : '',
      ].filter(Boolean).join(' ')}
    >
      {message}
    </section>
  );
}
