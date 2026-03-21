import { useLayoutEffect, useRef } from 'react';

const scrollPositions = new Map<string, number>();

interface ScrollRestorationOptions {
  skipRestore?: boolean;
}

export function useScrollRestoration<T extends HTMLElement>(key: string, options: ScrollRestorationOptions = {}) {
  const ref = useRef<T | null>(null);
  const { skipRestore = false } = options;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    const restoreScroll = () => {
      if (skipRestore) {
        return;
      }

      const saved = scrollPositions.get(key);
      if (saved !== undefined) {
        el.scrollTop = saved;
      }
    };

    restoreScroll();
    const rafA = window.requestAnimationFrame(restoreScroll);
    const rafB = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(restoreScroll);
    });

    const handleScroll = () => {
      scrollPositions.set(key, el.scrollTop);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollPositions.set(key, el.scrollTop);
      el.removeEventListener('scroll', handleScroll);
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
    };
  }, [key, skipRestore]);

  return ref;
}
