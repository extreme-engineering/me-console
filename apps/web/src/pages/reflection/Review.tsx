import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  format,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  endOfWeek,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
} from 'date-fns';
import { Save, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { PeriodicReview } from '@meos/shared';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import LoadingSpinner from '../../components/LoadingSpinner';
import MockBadge from '../../components/MockBadge';
import Daily from './Daily';
import { toast } from '../../stores/toastStore';

type Period = 'week' | 'month' | 'quarter' | 'year';

interface ReviewItem extends PeriodicReview {
  mock?: boolean;
}

interface ReviewsResponse {
  reviews?: ReviewItem[];
}

const PERIOD_LABELS: Record<Period, string> = {
  week: '周',
  month: '月',
  quarter: '季',
  year: '年',
};

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      toast.error('操作失败，请重试');
      return [];
    }
  }
  return [];
}

function getPeriodRange(period: Period, offset: number): { start: Date; end: Date } {
  const now = new Date();
  let base: Date;
  switch (period) {
    case 'week':
      base = offset >= 0 ? subWeeks(startOfWeek(now, { weekStartsOn: 1 }), -offset) : subWeeks(startOfWeek(now, { weekStartsOn: 1 }), Math.abs(offset));
      return { start: base, end: endOfWeek(base, { weekStartsOn: 1 }) };
    case 'month':
      base = offset >= 0 ? subMonths(startOfMonth(now), -offset) : subMonths(startOfMonth(now), Math.abs(offset));
      return { start: base, end: endOfMonth(base) };
    case 'quarter':
      base = offset >= 0 ? subQuarters(startOfQuarter(now), -offset) : subQuarters(startOfQuarter(now), Math.abs(offset));
      return { start: base, end: endOfQuarter(base) };
    case 'year':
      base = offset >= 0 ? subYears(startOfYear(now), -offset) : subYears(startOfYear(now), Math.abs(offset));
      return { start: base, end: endOfYear(base) };
  }
}

export default function Review() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'daily' | 'periodic'>(
    searchParams.get('view') === 'daily' ? 'daily' : 'periodic'
  );

  const handleTabChange = (tab: 'daily' | 'periodic') => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'daily') {
        next.set('view', 'daily');
      } else {
        next.delete('view');
      }
      return next;
    });
  };

  const [period, setPeriod] = useState<Period>('week');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [existingId, setExistingId] = useState<string | null>(null);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<string[]>([]);
  const [insights, setInsights] = useState('');
  const [nextFocus, setNextFocus] = useState<string[]>([]);

  const [achieveInput, setAchieveInput] = useState('');
  const [challengeInput, setChallengeInput] = useState('');
  const [focusInput, setFocusInput] = useState('');

  const { start, end } = getPeriodRange(period, periodOffset);
  const startDate = format(start, 'yyyy-MM-dd');
  const endDate = format(end, 'yyyy-MM-dd');

  useEffect(() => {
    setPeriodOffset(0);
  }, [period]);

  const reviewsQuery = useApiQuery<ReviewsResponse>(['reviews'], '/reviews');
  const reviews = useMemo(() => reviewsQuery.data?.reviews ?? [], [reviewsQuery.data]);

  const createReview = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/reviews', data), [['reviews']]);
  const updateReview = useApiMutation(({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/reviews/${id}`, data), [['reviews']]);
  const deleteReview = useApiMutation((id: string) => apiRequest('delete', `/reviews/${id}`), [['reviews']]);

  useEffect(() => {
    const match = reviews.find((r) => {
      return r.period === period && format(new Date(r.startDate), 'yyyy-MM-dd') === startDate;
    });

    if (match) {
      setExistingId(match.id);
      setAchievements(parseJsonArray(match.achievements));
      setChallenges(parseJsonArray(match.challenges));
      setInsights(match.insights || '');
      setNextFocus(parseJsonArray(match.nextFocus));
    } else {
      setExistingId(null);
      setAchievements([]);
      setChallenges([]);
      setInsights('');
      setNextFocus([]);
    }
  }, [period, periodOffset, reviews, startDate]);

  const addItem = (list: string[], setList: (v: string[]) => void, input: string, setInput: (v: string) => void) => {
    const trimmed = input.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput('');
  };

  const removeItem = (list: string[], setList: (v: string[]) => void, idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        period,
        startDate,
        endDate,
        achievements: JSON.stringify(achievements),
        challenges: JSON.stringify(challenges),
        insights,
        nextFocus: JSON.stringify(nextFocus),
      };
      if (existingId) {
        await updateReview.mutateAsync({ id: existingId, data: payload });
      } else {
        await createReview.mutateAsync(payload);
      }
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingId) return;
    if (!window.confirm('确定删除这个周期的复盘记录？')) return;
    setDeleting(true);
    try {
      await deleteReview.mutateAsync(existingId);
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  if (reviewsQuery.isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="page-enter">
      <div className="mb-6">
        <h1
          className="text-3xl mb-1"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
          }}
        >
          复盘中心
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          每日反思与周期复盘，萃取经验智慧
        </p>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <button
          onClick={() => handleTabChange('daily')}
          className={`px-4 py-2 text-sm rounded-lg transition-all ${
            activeTab === 'daily' ? 'font-medium' : ''
          }`}
          style={{
            backgroundColor: activeTab === 'daily' ? 'var(--color-surface)' : 'transparent',
            color: activeTab === 'daily' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            boxShadow: activeTab === 'daily' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          每日反思
        </button>
        <button
          onClick={() => handleTabChange('periodic')}
          className={`px-4 py-2 text-sm rounded-lg transition-all ${
            activeTab === 'periodic' ? 'font-medium' : ''
          }`}
          style={{
            backgroundColor: activeTab === 'periodic' ? 'var(--color-surface)' : 'transparent',
            color: activeTab === 'periodic' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            boxShadow: activeTab === 'periodic' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          周期复盘
        </button>
      </div>

      {activeTab === 'daily' ? (
        <Daily />
      ) : (
      <>
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm rounded-lg transition-all ${
                  period === p
                    ? 'bg-[var(--color-surface)] font-medium'
                    : ''
                }`}
                style={{
                  backgroundColor: period === p ? 'var(--color-surface)' : 'transparent',
                  color: period === p ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  boxShadow: period === p ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setPeriodOffset((o) => o - 1)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-base font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {format(start, 'yyyy年M月d日')} — {format(end, 'M月d日')}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {periodOffset === 0 ? '本' + PERIOD_LABELS[period] : periodOffset === -1 ? '上' + PERIOD_LABELS[period] : `${Math.abs(periodOffset)}个${PERIOD_LABELS[period]}前`}
            </p>
          </div>
          <button
            onClick={() => setPeriodOffset((o) => Math.min(o + 1, 0))}
            disabled={periodOffset === 0}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-tertiary)', opacity: periodOffset === 0 ? 0.3 : 1 }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          关键成果
        </label>
        <div className="space-y-2 mb-3">
          {achievements.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item}</span>
              <button onClick={() => removeItem(achievements, setAchievements, idx)} style={{ color: 'var(--color-text-tertiary)' }}>
                <ChevronRight className="w-3 h-3 rotate-90" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={achieveInput}
            onChange={(e) => setAchieveInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(achievements, setAchievements, achieveInput, setAchieveInput); } }}
            placeholder="输入后回车添加"
            className="input"
          />
          <button onClick={() => addItem(achievements, setAchievements, achieveInput, setAchieveInput)} className="btn btn-ghost">
            +
          </button>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          挑战与应对
        </label>
        <div className="space-y-2 mb-3">
          {challenges.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item}</span>
              <button onClick={() => removeItem(challenges, setChallenges, idx)} style={{ color: 'var(--color-text-tertiary)' }}>
                <ChevronRight className="w-3 h-3 rotate-90" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={challengeInput}
            onChange={(e) => setChallengeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(challenges, setChallenges, challengeInput, setChallengeInput); } }}
            placeholder="输入后回车添加"
            className="input"
          />
          <button onClick={() => addItem(challenges, setChallenges, challengeInput, setChallengeInput)} className="btn btn-ghost">
            +
          </button>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          新认知
        </label>
        <textarea
          value={insights}
          onChange={(e) => setInsights(e.target.value)}
          rows={4}
          placeholder="这个周期有什么新的认知或领悟？"
          className="input resize-none"
        />
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          下周期重点
        </label>
        <div className="space-y-2 mb-3">
          {nextFocus.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{item}</span>
              <button onClick={() => removeItem(nextFocus, setNextFocus, idx)} style={{ color: 'var(--color-text-tertiary)' }}>
                <ChevronRight className="w-3 h-3 rotate-90" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={focusInput}
            onChange={(e) => setFocusInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(nextFocus, setNextFocus, focusInput, setFocusInput); } }}
            placeholder="输入后回车添加"
            className="input"
          />
          <button onClick={() => addItem(nextFocus, setNextFocus, focusInput, setFocusInput)} className="btn btn-ghost">
            +
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-3 mb-6">
        {existingId && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn btn-ghost"
            style={{ color: 'var(--color-error)' }}
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? '删除中...' : '删除'}
          </button>
        )}
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save className="w-4 h-4" />
          {saving ? '保存中...' : '保存'}
        </button>
        {existingId && reviews.find((r) => r.id === existingId)?.mock && (
          <MockBadge
            onClick={async () => {
              await updateReview.mutateAsync({ id: existingId, data: { mock: false } });
            }}
          />
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>自动汇总</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--color-text-tertiary)' }}>自动汇总功能开发中</p>
      </div>
      </>
      )}
    </div>
  );
}
