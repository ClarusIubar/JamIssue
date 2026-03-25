import { useLayoutEffect, useRef } from 'react';

const scrollPositions = new Map<string, number>();

/**
 * 스크롤 복원 동작 여부를 제어하는 옵션 인터페이스입니다.
 */
interface ScrollRestorationOptions {
  skipRestore?: boolean;
}

/**
 * 탭을 전환하거나 컴포넌트가 언마운트될 때 현재 스크롤 위치를 기록하고,
 * 다시 마운트될 때 이전 위치로 스크롤을 복원해주는 커스텀 훅입니다.
 *
 * @param key 스크롤 위치를 캐싱하기 위한 고유 식별자 문자열입니다.
 * @param options 복원 기능을 일시적으로 건너뛸 수 있는 옵션 객체입니다.
 */
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
