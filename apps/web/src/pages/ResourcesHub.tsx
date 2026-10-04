import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Users } from 'lucide-react';
import MethodologyCard from '../components/MethodologyCard';
import HubTabs from '../components/HubTabs';
import Assets from './resources/Assets';
import Contacts from './resources/Contacts';

type TabKey = 'assets' | 'contacts';

const TABS = [
  { key: 'assets', label: '资产管理', icon: Wallet },
  { key: 'contacts', label: '人脉', icon: Users },
];

export default function ResourcesHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'assets';
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
          资源
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-3)' }}>
          资产管理与人脉维护，你的外部支持系统
        </p>
      </div>

      <HubTabs tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === 'contacts' && <MethodologyCard page="resources:contacts" />}

      {activeTab === 'assets' && <Assets />}
      {activeTab === 'contacts' && <Contacts />}
    </div>
  );
}
