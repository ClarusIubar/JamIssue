import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

/**
 * useAutoLoadMore 훅에서 사용하는 설정 인터페이스입니다.
 * 활성화 상태, 로딩 여부, 센티널(관찰 대상) 교차 시 실행할 함수, 기준 요소와 마진 등을 지정합니다.
 */
interface UseAutoLoadMoreOptions {
  enabled: boolean;
  loading: boolean;
  onLoadMore: () => Promise<void> | void;
  rootRef: RefObject<HTMLElement | null>;
  rootMargin?: string;
}

/**
 * 리스트의 가장 밑바닥(Sentinel) 요소가 화면에 나타날 때(IntersectionObserver),
 * 다음 데이터를 자동으로 불러오는(Load More) 무한 스크롤 커스텀 훅입니다.
 */
export function useAutoLoadMore({
  enabled,
  loading,
  onLoadMore,
  rootRef,
  rootMargin = '160px 0px',
}: UseAutoLoadMoreOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || loading || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    let requested = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (requested) {
          return;
        }

        if (entries.some((entry) => entry.isIntersecting)) {
          requested = true;
          void onLoadMore();
        }
      },
      {
        root: rootRef.current,
        rootMargin,
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);

    return () => {
      requested = true;
      observer.disconnect();
    };
  }, [enabled, loading, onLoadMore, rootMargin, rootRef]);

  return sentinelRef;
}
