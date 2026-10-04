import { useRef, useEffect } from 'react';

export interface HubTab {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
}

interface HubTabsProps {
  tabs: HubTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

const INK3 = 'var(--color-ink-3)';
const SURFACE = 'var(--color-surface)';
const PAPER2 = 'var(--color-paper-2)';
const SHADOW_SM = 'var(--shadow-sm)';

export default function HubTabs({ tabs, activeTab, onTabChange }: HubTabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex((t) => t.key === activeTab);
    let nextIndex: number | null = null;

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      onTabChange(tabs[nextIndex].key);
    }
  };

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label="页面分区"
      className="flex gap-1 mb-6 p-1 rounded-xl overflow-x-auto w-fit max-w-full"
      style={{ backgroundColor: PAPER2 }}
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            ref={isActive ? activeRef : undefined}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.key}`}
            id={`tab-${tab.key}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
              isActive ? 'font-medium' : ''
            }`}
            style={{
              backgroundColor: isActive ? SURFACE : 'transparent',
              color: isActive ? 'var(--color-ink)' : INK3,
              boxShadow: isActive ? SHADOW_SM : 'none',
            }}
          >
            <Icon size={15} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
