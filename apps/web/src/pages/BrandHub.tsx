import { useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Gem, GitBranch, Radio, Package, BarChart3 } from 'lucide-react';
import MethodologyCard from '../components/MethodologyCard';
import HubTabs from '../components/HubTabs';
import Overview from './brand/Overview';
import Profile from './brand/Profile';
import Pipeline from './brand/Pipeline';
import Channels from './brand/Channels';
import Works from './brand/Works';
import Analytics from './brand/Analytics';

type TabKey = 'overview' | 'profile' | 'pipeline' | 'channels' | 'works' | 'analytics';

const TABS = [
  { key: 'overview', label: '总览', icon: LayoutDashboard },
  { key: 'profile', label: '品牌资产', icon: Gem },
  { key: 'pipeline', label: '内容流水线', icon: GitBranch },
  { key: 'channels', label: '渠道与数据', icon: Radio },
  { key: 'analytics', label: '数据仪表', icon: BarChart3 },
  { key: 'works', label: '作品库', icon: Package },
];

export default function BrandHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = tabParam && TABS.some((t) => t.key === tabParam) ? tabParam : 'overview';

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
          品牌
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-3)' }}>
          定位、创作、分发与复盘——经营你唯一的品牌：你自己
        </p>
      </div>

      <HubTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      <MethodologyCard page={`brand:${activeTab}`} />

      {activeTab === 'overview' && <Overview />}
      {activeTab === 'profile' && <Profile />}
      {activeTab === 'pipeline' && <Pipeline />}
      {activeTab === 'channels' && <Channels />}
      {activeTab === 'analytics' && <Analytics />}
      {activeTab === 'works' && <Works />}
    </div>
  );
}
