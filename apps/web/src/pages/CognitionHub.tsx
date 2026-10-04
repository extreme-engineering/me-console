import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StickyNote, BookOpen, BrainCircuit, Lightbulb } from 'lucide-react';
import MethodologyCard from '../components/MethodologyCard';
import HubTabs from '../components/HubTabs';
import Notes from './cognition/Notes';
import Reading from './cognition/Reading';
import Topics from './cognition/Topics';
import Insights from './cognition/Insights';

type TabKey = 'notes' | 'reading' | 'topics' | 'insights';

const TABS = [
  { key: 'notes', label: '笔记', icon: StickyNote },
  { key: 'reading', label: '阅读', icon: BookOpen },
  { key: 'topics', label: '课题', icon: BrainCircuit },
  { key: 'insights', label: '洞察', icon: Lightbulb },
];

export default function CognitionHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'notes';
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
          认知
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-3)' }}>
          笔记、阅读、课题与洞察，构建你的第二大脑
        </p>
      </div>

      <HubTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <MethodologyCard page={`cognition:${activeTab}`} />

      {activeTab === 'notes' && <Notes />}
      {activeTab === 'reading' && <Reading />}
      {activeTab === 'topics' && <Topics />}
      {activeTab === 'insights' && <Insights />}
    </div>
  );
}
