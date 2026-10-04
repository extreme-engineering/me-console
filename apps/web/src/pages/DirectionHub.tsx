import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Target, Compass, Flag, FileText, GitBranch } from 'lucide-react';
import MethodologyCard from '../components/MethodologyCard';
import HubTabs from '../components/HubTabs';
import Vision from './direction/Vision';
import Domains from './direction/Domains';
import Goals from './direction/Goals';
import OkrDoc from './direction/OkrDoc';
import Workflow from './direction/Workflow';

type TabKey = 'vision' | 'domains' | 'goals' | 'okrdoc' | 'workflow';

const TABS = [
  { key: 'vision', label: '愿景与价值观', icon: Target },
  { key: 'domains', label: '领域与平衡', icon: Compass },
  { key: 'goals', label: '目标与项目', icon: Flag },
  { key: 'okrdoc', label: 'OKR 文档', icon: FileText },
  { key: 'workflow', label: '工作流', icon: GitBranch },
];

export default function DirectionHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'vision';
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
          方向
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-3)' }}>
          愿景、领域与目标，定义你要去哪里
        </p>
      </div>

      <HubTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <MethodologyCard page={`direction:${activeTab}`} />

      {activeTab === 'vision' && <Vision />}
      {activeTab === 'domains' && <Domains />}
      {activeTab === 'goals' && <Goals />}
      {activeTab === 'okrdoc' && <OkrDoc />}
      {activeTab === 'workflow' && <Workflow />}
    </div>
  );
}
