import { useEffect, useState } from 'react';
import { ChevronRight, Compass, X } from 'lucide-react';
import SetupWizard from './SetupWizard';
import { loadStepStatuses, progressOf, type StepStatusInfo } from '../../lib/onboarding';

const DISMISS_KEY = 'meos.onboarding.dismissed';

/** 吊顶使用向导横幅：展示待完善的关键问题数，点击进入分步引导。 */
export default function OnboardingBanner() {
  const [statuses, setStatuses] = useState<StepStatusInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    loadStepStatuses()
      .then((s) => {
        if (!cancelled) {
          setStatuses(s);
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const closeWizard = () => {
    setWizardOpen(false);
    // 关闭向导后刷新状态，让横幅数字与向导保持一致
    loadStepStatuses().then(setStatuses).catch(() => undefined);
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // 关闭状态不持久也可接受
    }
  };

  const progress = progressOf(statuses);
  if (!loaded || dismissed || progress.pending === 0) return null;

  return (
    <>
      <div
        className="rounded-xl p-4 mb-6 flex items-center gap-4"
        style={{
          border: '1px solid var(--color-border-light)',
          borderLeft: '3px solid var(--color-accent)',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      >
        <Compass className="w-5 h-5 shrink-0" style={{ color: 'var(--color-accent)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            使用向导 · 还有 {progress.pending} 个关键问题待完善
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            已完成 {progress.done}/{progress.total}（{progress.percent}%）· 按「下一步」逐个回答，随时可以跳过
          </p>
        </div>
        <button
          className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90 flex items-center gap-1"
          style={{ backgroundColor: 'var(--color-accent)' }}
          onClick={() => setWizardOpen(true)}
        >
          继续填写 <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          className="shrink-0 p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-tertiary)' }}
          onClick={dismiss}
          aria-label="本次会话不再显示"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <SetupWizard open={wizardOpen} onClose={closeWizard} />
    </>
  );
}
