import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

const BUTTON_SIZE = 46;
const EDGE_PADDING = 12;
const BOTTOM_PADDING = 110;
const TOUCH_DRAG_DELAY_MS = 260;

/**
 * 플로팅 버튼의 현재 렌더링 위치를 나타내는 좌표 객체입니다.
 */
interface Position {
  x: number;
  y: number;
}

/**
 * 플로팅 버튼이 화면 가장자리(여백 고려) 밖으로 나가지 않도록 위치를 조정(Clamp)합니다.
 */
function clampPosition(position: Position) {
  if (typeof window === 'undefined') {
    return position;
  }

  const maxX = Math.max(EDGE_PADDING, window.innerWidth - BUTTON_SIZE - EDGE_PADDING);
  const maxY = Math.max(EDGE_PADDING, window.innerHeight - BUTTON_SIZE - BOTTOM_PADDING);

  return {
    x: Math.min(Math.max(position.x, EDGE_PADDING), maxX),
    y: Math.min(Math.max(position.y, EDGE_PADDING), maxY),
  };
}

/**
 * FloatingBackButton 컴포넌트의 Props 인터페이스입니다.
 * 클릭(혹은 탭) 시 이전 화면으로 돌아가기 위한 이벤트 핸들러를 받습니다.
 */
interface FloatingBackButtonProps {
  onNavigateBack: () => void;
}

/**
 * 화면 위에 떠 있으며 드래그로 위치를 자유롭게 이동할 수 있는 뒤로가기 버튼 컴포넌트입니다.
 * 드래그와 클릭 이벤트를 분리하여 모바일/데스크톱 모두에서 부드러운 상호작용을 지원합니다.
 */
export function FloatingBackButton({ onNavigateBack }: FloatingBackButtonProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const handledTapRef = useRef(false);
  const touchTimerRef = useRef<number | null>(null);
  const dragStateRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    hasMoved: false,
    dragEnabled: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    function handleResize() {
      setPosition((current) => (current ? clampPosition(current) : current));
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => () => {
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  const style = useMemo(
    () => (position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined),
    [position],
  );

  function clearTouchTimer() {
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }

  function finishDrag(pointerId: number) {
    if (dragStateRef.current.pointerId !== pointerId) {
      return;
    }

    clearTouchTimer();
    dragStateRef.current.pointerId = -1;
    dragStateRef.current.dragEnabled = false;
    setIsDragging(false);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    handledTapRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position?.x ?? rect.left,
      originY: position?.y ?? rect.top,
      hasMoved: false,
      dragEnabled: event.pointerType === 'mouse',
    };

    if (event.pointerType !== 'mouse') {
      clearTouchTimer();
      touchTimerRef.current = window.setTimeout(() => {
        if (dragStateRef.current.pointerId === event.pointerId) {
          dragStateRef.current.dragEnabled = true;
          setIsDragging(true);
        }
      }, TOUCH_DRAG_DELAY_MS);
    } else {
      setIsDragging(true);
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.startX;
    const deltaY = event.clientY - dragStateRef.current.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragStateRef.current.hasMoved = true;
    }

    if (!dragStateRef.current.dragEnabled) {
      return;
    }

    event.preventDefault();
    setIsDragging(true);
    setPosition(
      clampPosition({
        x: dragStateRef.current.originX + deltaX,
        y: dragStateRef.current.originY + deltaY,
      }),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const shouldNavigate =
      dragStateRef.current.pointerId === event.pointerId &&
      !dragStateRef.current.hasMoved &&
      !dragStateRef.current.dragEnabled;
    finishDrag(event.pointerId);
    if (shouldNavigate) {
      handledTapRef.current = true;
      onNavigateBack();
    }
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    finishDrag(event.pointerId);
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (handledTapRef.current) {
      handledTapRef.current = false;
      event.preventDefault();
      return;
    }

    if (dragStateRef.current.hasMoved || isDragging) {
      event.preventDefault();
      return;
    }

    onNavigateBack();
  }

  return (
    <button
      type="button"
      className={isDragging ? 'app-back-button is-dragging' : 'app-back-button'}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      aria-label="이전 화면으로 돌아가기"
    >
      <span aria-hidden="true">{'\u2190'}</span>
    </button>
  );
}
