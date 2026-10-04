import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Dumbbell } from 'lucide-react';
import MethodologyCard from '../components/MethodologyCard';
import HubTabs from '../components/HubTabs';
import Todos from './action/Todos';
import Habits from './action/Habits';

type TabKey = 'todos' | 'habits';

const TABS = [
  { key: 'todos', label: '待办', icon: CheckCircle2 },
  { key: 'habits', label: '习惯', icon: Dumbbell },
];

export default function ActionHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'todos';
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
          行动
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-3)' }}>
          待办事项与习惯追踪，把意图变成结果
        </p>
      </div>

      <HubTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <MethodologyCard page={`action:${activeTab}`} />

      {activeTab === 'todos' && <Todos />}
      {activeTab === 'habits' && <Habits />}
    </div>
  );
}
