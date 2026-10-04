import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sun, CalendarDays } from 'lucide-react';
import MethodologyCard from '../components/MethodologyCard';
import HubTabs from '../components/HubTabs';
import Daily from './reflection/Daily';
import Review from './reflection/Review';

type TabKey = 'daily' | 'periodic';

const TABS = [
  { key: 'daily', label: '每日反思', icon: Sun },
  { key: 'periodic', label: '周期复盘', icon: CalendarDays },
];

export default function ReflectionHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'daily';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabKey);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  return (
    <div className="page-enter">
      <div className="mb-6">
        <h1
          className="text-3xl mb-1"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
          }}
        >
          反思
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-3)' }}>
          每日反思与周期复盘，萃取经验智慧
        </p>
      </div>

      <HubTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <MethodologyCard page={`reflection:${activeTab}`} />

      {activeTab === 'daily' ? <Daily /> : <Review />}
    </div>
  );
}
