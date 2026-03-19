import { useEffect, useRef } from 'react';

const scrollPositions = new Map<string, number>();

export function useScrollRestoration<T extends HTMLElement>(key: string) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    const saved = scrollPositions.get(key);
    if (saved !== undefined) {
      el.scrollTop = saved;
    }

    return () => {
      scrollPositions.set(key, el.scrollTop);
    };
  }, [key]);

  return ref;
}
