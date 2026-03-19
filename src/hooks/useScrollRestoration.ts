import { useLayoutEffect, useRef } from 'react';

const scrollPositions = new Map<string, number>();

export function useScrollRestoration<T extends HTMLElement>(key: string) {
  const ref = useRef<T | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    const restoreScroll = () => {
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
  }, [key]);

  return ref;
}
