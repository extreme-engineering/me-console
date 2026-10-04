import { useMemo, useState } from 'react';
import { Play, Sparkles, Clock3, CalendarClock, Cpu } from 'lucide-react';
import type { MeLogOverview, MeLogRun, MeLogSkill } from '@meos/shared';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import { formatTime } from './meta';

type SkillEngine = 'auto' | 'rule' | 'llm';

const ENGINE_OPTIONS: { value: SkillEngine; label: string }[] = [
  { value: 'auto', label: '引擎：自动' },
  { value: 'rule', label: '引擎：规则' },
  { value: 'llm', label: '引擎：LLM' },
];

function engineOf(skill: MeLogSkill): SkillEngine {
  try {
    const parsed = JSON.parse(skill.config || '{}');
    if (parsed.engine === 'rule' || parsed.engine === 'llm' || parsed.engine === 'auto') return parsed.engine;
  } catch {
    // 忽略非法配置
  }
  return 'auto';
}

interface MeLogRunRow extends MeLogRun {
  skill?: { name: string; slug: string };
}

interface MeLogSchedule {
  id: string;
  skillId: string;
  kind: string;
  dailyAt?: string;
  intervalHours?: number;
  enabled: boolean;
  nextRunAt?: string;
}

interface SkillRunPayload {
  skillId: string;
  days?: number;
}

interface SchedulePayload {
  skillId: string;
  kind: 'daily' | 'interval';
  dailyAt?: string;
  intervalHours?: number;
}

const PERIOD_OPTIONS = [
  { days: 1, label: '近 1 天' },
  { days: 7, label: '近 7 天' },
  { days: 30, label: '近 30 天' },
];

const SCHEDULE_OPTIONS = [
  { value: 'manual', label: '手动运行' },
  { value: 'daily:09:00', label: '每天 09:00' },
  { value: 'interval:12', label: '每 12 小时' },
  { value: 'interval:8', label: '每 8 小时' },
  { value: 'interval:6', label: '每 6 小时' },
];

function scheduleToValue(schedule?: MeLogSchedule): string {
  if (!schedule || !schedule.enabled) return 'manual';
  if (schedule.kind === 'daily') return `daily:${schedule.dailyAt}`;
  return `interval:${schedule.intervalHours}`;
}

const SOURCE_LABEL: Record<string, string> = {
  builtin: '内置',
  community: '社区',
  custom: '自定义',
};

export default function Skills() {
  const [runningSlug, setRunningSlug] = useState('');
  const [selectedRun, setSelectedRun] = useState<MeLogRunRow | null>(null);
  const [periodBySlug, setPeriodBySlug] = useState<Record<string, number>>({});

  const skillsQuery = useApiQuery<{ skills: MeLogSkill[] }>(['melog/skills'], '/melog/skills');
  const runsQuery = useApiQuery<{ runs: MeLogRunRow[] }>(['melog/runs'], '/melog/runs');
  const schedulesQuery = useApiQuery<{ schedules: MeLogSchedule[] }>(['melog/schedules'], '/melog/schedules');
  const overviewQuery = useApiQuery<MeLogOverview>(['melog/overview'], '/melog/overview');

  const skills = skillsQuery.data?.skills ?? [];
  const runs = runsQuery.data?.runs ?? [];
  const llmInfo = overviewQuery.data?.llm || { configured: false };

  const schedulesBySkill = useMemo(() => {
    const map: Record<string, MeLogSchedule> = {};
    for (const schedule of schedulesQuery.data?.schedules ?? []) {
      map[schedule.skillId] = schedule;
    }
    return map;
  }, [schedulesQuery.data]);

  const runSkill = useApiMutation(
    ({ skillId, days }: SkillRunPayload) =>
      apiRequest<{ run: MeLogRunRow }>('post', `/melog/skills/${skillId}/run`, days ? { days } : {}),
    [['melog/skills'], ['melog/runs']]
  );

  const createSchedule = useApiMutation(
    (data: SchedulePayload) => apiRequest('post', '/melog/schedules', data),
    [['melog/schedules']]
  );

  const deleteSchedule = useApiMutation(
    (id: string) => apiRequest('delete', `/melog/schedules/${id}`),
    [['melog/schedules']]
  );

  const updateSkillEngine = useApiMutation(
    ({ id, config }: { id: string; config: string }) => apiRequest('patch', `/melog/skills/${id}`, { config }),
    [['melog/skills']]
  );

  const handleRun = async (skill: MeLogSkill) => {
    setRunningSlug(skill.slug);
    try {
      const days = periodBySlug[skill.slug];
      const { run: created } = await runSkill.mutateAsync({ skillId: skill.id, days });
      setSelectedRun({ ...created, skill: { name: skill.name, slug: skill.slug } });
    } catch {
      // 运行失败保持静默，历史记录中可见
    } finally {
      setRunningSlug('');
    }
  };

  const handleScheduleChange = async (skill: MeLogSkill, value: string) => {
    const existing = schedulesBySkill[skill.id];
    try {
      if (value === 'manual') {
        if (existing) await deleteSchedule.mutateAsync(existing.id);
      } else if (value.startsWith('daily:')) {
        await createSchedule.mutateAsync({ skillId: skill.id, kind: 'daily', dailyAt: value.slice(6) });
      } else if (value.startsWith('interval:')) {
        await createSchedule.mutateAsync({ skillId: skill.id, kind: 'interval', intervalHours: Number(value.slice(9)) });
      }
    } catch {
      // 定时设置失败保持静默，重新加载恢复当前值
      schedulesQuery.refetch();
    }
  };

  const handleEngineChange = async (skill: MeLogSkill, engine: SkillEngine) => {
    try {
      await updateSkillEngine.mutateAsync({
        id: skill.id,
        config: JSON.stringify({ ...(() => { try { return JSON.parse(skill.config || '{}'); } catch { return {}; } })(), engine }),
      });
    } catch {
      skillsQuery.refetch();
    }
  };

  if (skillsQuery.isLoading || runsQuery.isLoading || schedulesQuery.isLoading || overviewQuery.isLoading) return <LoadingSpinner />;

  return (
    <div>
      {/* LLM 状态横幅 */}
      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-xs"
        style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px dashed var(--color-border-light)', color: 'var(--color-text-secondary)' }}
      >
        <Cpu size={13} />
        {llmInfo.configured ? (
          <span>
            LLM 已配置（<strong>{llmInfo.model}</strong>）——引擎为「自动」或「LLM」的技能将由模型生成报告，数据仅发送到你配置的端点
          </span>
        ) : (
          <span>
            未配置 LLM，技能使用内置规则引擎。设置环境变量 MELOG_LLM_BASE_URL / MELOG_LLM_API_KEY / MELOG_LLM_MODEL（OpenAI 兼容接口，支持本地 Ollama）后可切换为模型生成
          </span>
        )}
      </div>

      {skills.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={24} strokeWidth={1} />}
          title="暂无技能"
          description="内置技能会在首次打开时自动安装"
        />
      ) : (
        <div className="grid md:grid-cols-3 gap-3 mb-8">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="rounded-xl p-4 flex flex-col"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-amber-500" />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {skill.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 ml-auto">
                  {SOURCE_LABEL[skill.source] || skill.source} · v{skill.version}
                </span>
              </div>
              <p className="text-xs flex-1 mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                {skill.description || '暂无描述'}
              </p>

              <div className="flex items-center gap-2">
                <select
                  value={periodBySlug[skill.slug] ?? ''}
                  onChange={(e) =>
                    setPeriodBySlug((prev) => ({ ...prev, [skill.slug]: Number(e.target.value) }))
                  }
                  className="px-2 py-1.5 text-[11px] rounded-lg outline-none"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-light)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <option value="">默认周期</option>
                  {PERIOD_OPTIONS.map((option) => (
                    <option key={option.days} value={option.days}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleRun(skill)}
                  disabled={runningSlug === skill.slug}
                  className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-ink-soft)' }}
                >
                  <Play size={11} />
                  {runningSlug === skill.slug ? '运行中…' : '运行'}
                </button>
              </div>

              <div
                className="flex items-center gap-1 text-[11px] mt-1.5"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <Clock3 size={11} />
                最近运行：{formatTime(skill.lastRunAt)}
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                <label className="flex items-center gap-1">
                  <Cpu size={11} />
                  <select
                    value={engineOf(skill)}
                    onChange={(e) => handleEngineChange(skill, e.target.value as SkillEngine)}
                    className="text-[11px] bg-transparent outline-none"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {ENGINE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  <CalendarClock size={11} />
                  <select
                    value={scheduleToValue(schedulesBySkill[skill.id])}
                    onChange={(e) => handleScheduleChange(skill, e.target.value)}
                    className="text-[11px] bg-transparent outline-none"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {SCHEDULE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
        运行历史
      </h3>
      {runs.length === 0 ? (
        <EmptyState title="还没有运行记录" description="点击技能卡片上的「运行」生成第一份报告" />
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRun(run)}
              className="w-full text-left flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-slate-50"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: run.status === 'succeeded' ? '#10b981' : run.status === 'failed' ? '#ef4444' : '#f59e0b' }}
              />
              <span className="text-xs font-medium shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                {run.skill?.name || '技能'}
              </span>
              <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text-secondary)' }}>
                {run.summary || '—'}
              </span>
              <span className="text-[11px] shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                {formatTime(run.createdAt)}
              </span>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={selectedRun !== null}
        onClose={() => setSelectedRun(null)}
        title={selectedRun?.skill?.name || '技能报告'}
        maxWidth="max-w-2xl"
      >
        {selectedRun?.summary && (
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
            {selectedRun.summary}
          </p>
        )}
        {(() => {
          let stats: { linkedReviewId?: string; engine?: string } | null = null;
          try {
            stats = JSON.parse(selectedRun?.stats || '{}') as { linkedReviewId?: string; engine?: string };
          } catch {
            stats = null;
          }
          if (!stats) return null;
          const engineLabel = stats.engine === 'llm' ? 'LLM' : stats.engine === 'rule' ? '规则引擎' : null;
          return (
            <div className="flex items-center gap-3 mb-3 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {engineLabel && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">引擎：{engineLabel}</span>
              )}
              {stats.linkedReviewId && (
                <span style={{ color: '#059669' }}>✅ 已同步为「反思 → 周期复盘」草稿</span>
              )}
            </div>
          );
        })()}
        <pre
          className="text-xs whitespace-pre-wrap font-sans leading-relaxed max-h-[60vh] overflow-y-auto"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {selectedRun?.result || '（无输出）'}
        </pre>
      </Modal>
    </div>
  );
}
