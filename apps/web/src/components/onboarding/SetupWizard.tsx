import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  List,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import Modal from '../Modal';
import LoadingSpinner from '../LoadingSpinner';
import {
  loadStepStatuses,
  progressOf,
  saveSkip,
  type StepStatusInfo,
} from '../../lib/onboarding';

interface SetupWizardProps {
  open: boolean;
  onClose: () => void;
}

const STATE_LABEL: Record<StepStatusInfo['state'], string> = {
  filled: '已填写',
  todo: '待填写',
  skipped: '已跳过',
};

const STATE_COLOR: Record<StepStatusInfo['state'], string> = {
  filled: '#10b981',
  todo: '#f59e0b',
  skipped: '#94a3b8',
};

export default function SetupWizard({ open, onClose }: SetupWizardProps) {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<StepStatusInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'step' | 'overview'>('step');
  const [stepIdx, setStepIdx] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatuses(await loadStepStatuses());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setStepIdx(0);
      setView('step');
      refresh();
    }
  }, [open, refresh]);

  const pending = statuses.filter((s) => s.state !== 'filled');
  const progress = progressOf(statuses);
  const current = pending[Math.min(stepIdx, Math.max(pending.length - 1, 0))];

  const setState = (id: string, state: StepStatusInfo['state']) => {
    saveSkip(id, state === 'skipped');
    setStatuses((prev) =>
      prev.map((s) => (s.step.id === id ? { ...s, state: s.count > 0 ? 'filled' : state } : s)),
    );
  };

  const goFill = (route: string) => {
    onClose();
    navigate(route);
  };

  const renderFooterButtons = (info: StepStatusInfo) => (
    <>
      <button
        className="px-3 py-1.5 rounded-lg text-xs transition-colors"
        style={{ color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border-light)' }}
        onClick={() => setState(info.step.id, info.state === 'skipped' ? 'todo' : 'skipped')}
      >
        {info.state === 'skipped' ? (
          <span className="flex items-center gap-1"><RotateCcw className="w-3 h-3" /> 取消跳过</span>
        ) : (
          <span className="flex items-center gap-1"><SkipForward className="w-3 h-3" /> 跳过</span>
        )}
      </button>
      <button
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--color-accent)' }}
        onClick={() => goFill(info.step.route)}
      >
        去填写 <ArrowRight className="w-3 h-3 inline" />
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="使用向导" maxWidth="max-w-2xl">
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingSpinner />
        </div>
      ) : progress.total === 0 ? (
        <div className="px-6 py-10 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          当前数据模式下暂无可引导的步骤。
        </div>
      ) : (
        <div className="px-6 py-5">
          {/* 总进度 */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              已完成 {progress.done}/{progress.total} · 待完善 {progress.pending}
            </p>
            <button
              className="text-xs flex items-center gap-1 transition-colors"
              style={{ color: 'var(--color-accent)' }}
              onClick={() => setView(view === 'step' ? 'overview' : 'step')}
            >
              <List className="w-3.5 h-3.5" />
              {view === 'step' ? '查看总览' : '回到引导'}
            </button>
          </div>
          <div className="h-1.5 rounded-full mb-6 overflow-hidden" style={{ backgroundColor: 'var(--color-border-light)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress.percent}%`, backgroundColor: 'var(--color-accent)' }}
            />
          </div>

          {view === 'overview' ? (
            /* ---------- 总览：所有关键问题的填写状态 ---------- */
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {statuses.map((info) => (
                <div
                  key={info.step.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ border: '1px solid var(--color-border-light)' }}
                >
                  {info.state === 'filled' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: STATE_COLOR.filled }} />
                  ) : (
                    <Circle className="w-4 h-4 shrink-0" style={{ color: STATE_COLOR[info.state] }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded mr-2 align-middle"
                        style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}
                      >
                        {info.step.module}
                      </span>
                      {info.step.title}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      {info.count > 0 ? `已录入 ${info.count} 条` : info.step.question}
                    </p>
                  </div>
                  <span
                    className="text-[11px] shrink-0 px-1.5 py-0.5 rounded"
                    style={{ color: STATE_COLOR[info.state], backgroundColor: 'var(--color-bg-secondary)' }}
                  >
                    {STATE_LABEL[info.state]}
                  </span>
                  {info.state === 'filled' ? (
                    <button
                      className="text-xs shrink-0 flex items-center gap-0.5"
                      style={{ color: 'var(--color-accent)' }}
                      onClick={() => goFill(info.step.route)}
                    >
                      查看 <ArrowRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">{renderFooterButtons(info)}</div>
                  )}
                </div>
              ))}
            </div>
          ) : progress.pending === 0 ? (
            /* ---------- 全部完成 ---------- */
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: STATE_COLOR.filled }} />
              <p className="text-base font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                关键问题都回答完了
              </p>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
                你的个人操作系统已完成初始设置，之后随时可以回来补充。
              </p>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--color-accent)' }}
                onClick={onClose}
              >
                开始使用
              </button>
            </div>
          ) : (
            /* ---------- 分步引导 ---------- */
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-[11px] px-2 py-0.5 rounded font-medium text-white"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {current.step.module}
                </span>
                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  第 {stepIdx + 1} / {pending.length} 个待完善
                  {current.state === 'skipped' ? '（已跳过）' : ''}
                </span>
              </div>
              <h3
                className="text-xl mb-2"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
              >
                {current.step.question}
              </h3>
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                {current.step.why}
              </p>
              <div className="flex items-center justify-between">
                <button
                  className="px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40"
                  style={{ color: 'var(--color-text-tertiary)', border: '1px solid var(--color-border-light)' }}
                  disabled={stepIdx === 0}
                  onClick={() => setStepIdx((i) => Math.max(i - 1, 0))}
                >
                  <ChevronLeft className="w-3.5 h-3.5 inline" /> 上一步
                </button>
                <div className="flex items-center gap-2">{renderFooterButtons(current)}</div>
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
                  disabled={stepIdx >= pending.length - 1}
                  onClick={() => setStepIdx((i) => Math.min(i + 1, pending.length - 1))}
                >
                  下一步 <ChevronRight className="w-3.5 h-3.5 inline" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
