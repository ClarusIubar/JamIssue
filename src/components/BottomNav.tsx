import type { Tab } from '../types';

/**
 * BottomNav 컴포넌트의 Props 인터페이스입니다.
 * 현재 활성화된 탭과 탭 변경 시 호출될 콜백 함수를 전달받습니다.
 */
interface BottomNavProps {
  activeTab: Tab;
  onChange: (nextTab: Tab) => void;
}

const items: Array<{ key: Tab; label: string }> = [
  { key: 'map', label: '지도' },
  { key: 'event', label: '행사' },
  { key: 'feed', label: '피드' },
  { key: 'course', label: '코스' },
  { key: 'my', label: '마이' },
];

/**
 * 앱 최하단에 고정되어 주요 탭(지도, 행사, 피드, 코스, 마이) 간의 전환을 담당하는
 * 글로벌 내비게이션 바(GNB) 컴포넌트입니다.
 */
export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="하단 네비게이션">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={item.key === activeTab ? 'bottom-nav__item is-active' : 'bottom-nav__item'}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
