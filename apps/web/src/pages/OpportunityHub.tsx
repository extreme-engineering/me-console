import { useSearchParams } from 'react-router-dom';
import { Radar, Flower2, Ship } from 'lucide-react';
import type { OpportunityTrack } from '@meos/shared';
import MethodologyCard from '../components/MethodologyCard';
import HubTabs from '../components/HubTabs';
import OpportunityBoard from './opportunity/OpportunityBoard';
import { TRACK_CONFIGS } from './opportunity/constants';

type TabKey = OpportunityTrack;

const TABS = [
  { key: 'fde', label: TRACK_CONFIGS.fde.label, icon: Radar },
  { key: 'meditation', label: TRACK_CONFIGS.meditation.label, icon: Flower2 },
  { key: 'trade', label: TRACK_CONFIGS.trade.label, icon: Ship },
];

export default function OpportunityHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : 'fde';

  const handleTabChange = (tab: string) => {
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
          商机
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-3)' }}>
          线索 → 接触 → 方案 → 谈判 → 成交 → 交付，三条业务线各一条管道
        </p>
      </div>

      <HubTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <MethodologyCard page={`opportunity:${activeTab}`} />

      <OpportunityBoard key={activeTab} track={activeTab} />
    </div>
  );
}
