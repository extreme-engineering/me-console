import { useEffect, useMemo, useRef, useState } from 'react';
import { format, startOfDay } from 'date-fns';
import { Calendar, Plus, X, Save, Sparkles, Trash2 } from 'lucide-react';
import type { Reflection } from '@meos/shared';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import LoadingSpinner from '../../components/LoadingSpinner';
import MockBadge from '../../components/MockBadge';
import { toast } from '../../stores/toastStore';

interface ReflectionItem extends Reflection {
  mock?: boolean;
}

interface ReflectionsResponse {
  reflections?: ReflectionItem[];
}

interface TodayData {
  date: string;
  summary: string;
  todos: { total: number; createdToday: number; items: string[] };
  habits: { total: number; items: string[] };
  health: { total: number; items: { type: string; value: number; unit: string; label: string }[] };
}

const MOOD_OPTIONS = [
  { emoji: '😊', value: 'happy' },
  { emoji: '😐', value: 'neutral' },
  { emoji: '😢', value: 'sad' },
  { emoji: '😤', value: 'angry' },
  { emoji: '😴', value: 'tired' },
];

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

export default function Daily() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);

  const [existingId, setExistingId] = useState<string | null>(null);
  const [celebrations, setCelebrations] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [tomorrow, setTomorrow] = useState('');
  const [mood, setMood] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [deleting, setDeleting] = useState(false);
  const prefilledDate = useRef<string | null>(null);

  const [celebInput, setCelebInput] = useState('');
  const [improvInput, setImprovInput] = useState('');

  const reflectionsQuery = useApiQuery<ReflectionsResponse>(['reflections'], '/reflections');
  const reflections = useMemo(() => reflectionsQuery.data?.reflections ?? [], [reflectionsQuery.data]);
  const todaySummaryQuery = useApiQuery<TodayData>(['reflections', 'today-summary', selectedDate], `/reflections/today-summary?date=${selectedDate}`);
  const todayData = todaySummaryQuery.data ?? null;

  const createReflection = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/reflections', data), [['reflections']]);
  const updateReflection = useApiMutation(({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/reflections/${id}`, data), [['reflections']]);
  const deleteReflection = useApiMutation((id: string) => apiRequest('delete', `/reflections/${id}`), [['reflections']]);
  const createTodo = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/todos', data), [['todos']]);

  useEffect(() => {
    const target = format(startOfDay(new Date(selectedDate)), 'yyyy-MM-dd');
    const match = reflections.find((r) => {
      const rawDate = r.date || r.createdAt;
      if (!rawDate) return false;
      const rDate = format(startOfDay(new Date(rawDate)), 'yyyy-MM-dd');
      return rDate === target;
    });

    if (match) {
      setExistingId(match.id);
      setCelebrations(parseJsonArray(match.celebrations));
      setImprovements(parseJsonArray(match.improvements));
      setTomorrow(match.tomorrow || '');
      setMood(match.mood || '');
      setTags(parseJsonArray(match.tags).join(', '));
      setContent(match.content || '');
    } else {
      setExistingId(null);
      setCelebrations([]);
      setImprovements([]);
      setTomorrow('');
      setMood('');
      setTags('');
      setContent('');
    }
  }, [selectedDate, reflections]);

  // 当日数据：无反思草稿时自动预填到「自由记录」（汇总失败不影响反思填写）
  useEffect(() => {
    const target = format(startOfDay(new Date(selectedDate)), 'yyyy-MM-dd');
    const hasReflection = reflections.some((r) => {
      const rawDate = r.date || r.createdAt;
      if (!rawDate) return false;
      return format(startOfDay(new Date(rawDate)), 'yyyy-MM-dd') === target;
    });

    if (!hasReflection && todayData?.summary && prefilledDate.current !== selectedDate) {
      prefilledDate.current = selectedDate;
      setContent(todayData.summary);
    }
  }, [selectedDate, reflections, todayData]);

  const handleInsertSummary = () => {
    if (!todayData?.summary) return;
    setContent((prev) =>
      prev.trim() ? `${prev.trim()}\n\n今日概况：${todayData.summary}` : `今日概况：${todayData.summary}`,
    );
  };

  const addCeleb = () => {
    const trimmed = celebInput.trim();
    if (trimmed && !celebrations.includes(trimmed)) {
      setCelebrations([...celebrations, trimmed]);
    }
    setCelebInput('');
  };

  const removeCeleb = (idx: number) => {
    setCelebrations(celebrations.filter((_, i) => i !== idx));
  };

  const addImprov = () => {
    const trimmed = improvInput.trim();
    if (trimmed && !improvements.includes(trimmed)) {
      setImprovements([...improvements, trimmed]);
    }
    setImprovInput('');
  };

  const removeImprov = (idx: number) => {
    setImprovements(improvements.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        // Supabase 为 timestamptz、API 为 ISO datetime：统一发送完整时间戳；
        // 取本地正午避免时区偏移导致日期落到前一天/后一天
        date: new Date(`${selectedDate}T12:00:00`).toISOString(),
        celebrations,
        improvements,
        tomorrow,
        mood,
        tags: tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        content,
      };
      if (existingId) {
        await updateReflection.mutateAsync({ id: existingId, data: payload });
      } else {
        await createReflection.mutateAsync(payload);
      }
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateTodo = async () => {
    if (!tomorrow.trim()) return;
    try {
      await createTodo.mutateAsync({ title: tomorrow.trim(), source: 'reflection' });
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleDelete = async () => {
    if (!existingId) return;
    if (!window.confirm('确定删除今天的反思记录？')) return;
    setDeleting(true);
    try {
      await deleteReflection.mutateAsync(existingId);
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  if (reflectionsQuery.isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="page-enter">
      <div className="mb-8">
        <h1
          className="text-3xl mb-1"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
          }}
        >
          每日复盘
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          记录今天的收获、反思和明天的计划
        </p>
      </div>

      <div className="card p-5 mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          值得庆祝的事
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {celebrations.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
            >
              {item}
              <button onClick={() => removeCeleb(idx)} style={{ color: 'var(--color-text-tertiary)' }}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={celebInput}
            onChange={(e) => setCelebInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCeleb(); } }}
            placeholder="输入后回车添加"
            className="input"
          />
          <button onClick={addCeleb} className="btn btn-ghost">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          可以改进的
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {improvements.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm"
              style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
            >
              {item}
              <button onClick={() => removeImprov(idx)} style={{ color: 'var(--color-text-tertiary)' }}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={improvInput}
            onChange={(e) => setImprovInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImprov(); } }}
            placeholder="输入后回车添加"
            className="input"
          />
          <button onClick={addImprov} className="btn btn-ghost">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          明日最重要的事
        </label>
        <textarea
          value={tomorrow}
          onChange={(e) => setTomorrow(e.target.value)}
          rows={3}
          placeholder="明天最重要的一件事是什么？"
          className="input resize-none"
        />
        {tomorrow.trim() && (
          <button
            onClick={handleGenerateTodo}
            className="mt-3 btn btn-ghost text-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            生成待办
          </button>
        )}
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          心情
        </label>
        <div className="flex gap-3">
          {MOOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMood(opt.value)}
              className={`w-12 h-12 rounded-xl text-xl flex items-center justify-center transition-all ${
                mood === opt.value
                  ? 'border-2'
                  : 'border'
              }`}
              style={{
                backgroundColor: mood === opt.value ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
                borderColor: mood === opt.value ? 'var(--color-text-primary)' : 'var(--color-border)',
              }}
            >
              {opt.emoji}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          标签
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="用逗号分隔多个标签"
          className="input"
        />
      </div>

      <div className="card p-5 mb-4">
        <label className="text-xs font-medium mb-3 block" style={{ color: 'var(--color-text-secondary)' }}>
          自由记录
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="写下你今天的想法和感受..."
          className="input resize-none"
        />
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
        {existingId && reflections.find((r) => r.id === existingId)?.mock && (
          <MockBadge
            onClick={async () => {
              await updateReflection.mutateAsync({ id: existingId, data: { mock: false } });
            }}
          />
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-tertiary)' }}>今日数据</h3>
        {todayData && todayData.summary ? (
          <>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {todayData.summary}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span
                className="px-2.5 py-1 rounded-full text-xs"
                style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
              >
                待办完成 {todayData.todos.total}（新增 {todayData.todos.createdToday}）
              </span>
              <span
                className="px-2.5 py-1 rounded-full text-xs"
                style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
              >
                习惯打卡 {todayData.habits.total} 项
              </span>
              <span
                className="px-2.5 py-1 rounded-full text-xs"
                style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
              >
                健康记录 {todayData.health.total} 条
              </span>
            </div>
            <button onClick={handleInsertSummary} className="mt-3 btn btn-ghost text-sm">
              <Sparkles className="w-3.5 h-3.5" />
              插入到自由记录
            </button>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            今天还没有数据。待办完成、习惯打卡、健康记录会汇总到这里，并自动预填到「自由记录」。
          </p>
        )}
      </div>
    </div>
  );
}
