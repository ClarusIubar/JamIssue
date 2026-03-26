import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

const BUTTON_SIZE = 46;
const EDGE_PADDING = 12;
const BOTTOM_PADDING = 110;
const TOUCH_DRAG_DELAY_MS = 260;

interface Position {
  x: number;
  y: number;
}

function getDefaultPosition(): Position {
  if (typeof window === 'undefined') {
    return { x: EDGE_PADDING, y: EDGE_PADDING };
  }

  return clampPosition({
    x: EDGE_PADDING,
    y: window.innerHeight - BUTTON_SIZE - BOTTOM_PADDING,
  });
}

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

interface FloatingBackButtonProps {
  onNavigateBack: () => void;
}

export function FloatingBackButton({ onNavigateBack }: FloatingBackButtonProps) {
  const [position, setPosition] = useState<Position>(getDefaultPosition);
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
      setPosition((current) => clampPosition(current));
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
    () => ({ left: position.x, top: position.y, right: 'auto', bottom: 'auto' }),
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

    handledTapRef.current = false;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
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
