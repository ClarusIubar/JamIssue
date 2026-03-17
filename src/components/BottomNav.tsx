import type { Tab } from '../types';

interface BottomNavProps {
  activeTab: Tab;
  onChange: (nextTab: Tab) => void;
}

const items: Array<{ key: Tab; label: string }> = [
  { key: 'map', label: '지도' },
  { key: 'feed', label: '피드' },
  { key: 'course', label: '코스' },
  { key: 'my', label: '마이' },
];

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
