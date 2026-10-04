import { useState } from 'react';
import { RefreshCw, Search, Radio, Mic, Brain, Footprints, Moon, Scale, FileText, ListTodo } from 'lucide-react';
import type { MeLogEntry, MeLogOverview } from '@meos/shared';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { CATEGORY_META, MELOG_CATEGORY_LIST, formatTime, type MeLogCategory } from './meta';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';

interface MeLogEntryRow extends MeLogEntry {
  source?: { name: string; adapter: string; category: string };
}

interface ParsedCaptureItem {
  index: number;
  category: 'health' | 'note';
  type: string;
  title: string;
  value: number | null;
  unit: string | null;
  source: string | null;
  pace: string | null;
  occurredAt: string;
  raw: string;
}

interface CaptureSubmitResponse {
  created: number;
  healthRecords: number;
  todos?: number;
}

const CAPTURE_TYPE_META: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  meditation: { label: '冥想', icon: Brain, color: '#8b5cf6' },
  exercise: { label: '运动', icon: Footprints, color: '#e11d48' },
  sleep: { label: '睡眠', icon: Moon, color: '#2563eb' },
  weight: { label: '体重', icon: Scale, color: '#d97706' },
  todo: { label: '待办', icon: ListTodo, color: '#0d9488' },
  note: { label: '笔记', icon: FileText, color: '#475569' },
};

const CAPTURE_PLACEHOLDER = [
  '照这个句式念：时间（今天/昨天/前天 + 早上/下午/晚上）+ 来源（潮汐/Keep）+ 动作 + 数量',
  '示例：今天早上潮汐冥想15分钟，昨晚Keep跑步5公里配速5分30秒，昨天睡眠7小时',
  '支持：冥想 X 分钟 · 跑步 X 公里 · 健身/拉伸/瑜伽等 X 分钟 · 睡眠 X 小时 · 体重 X 公斤',
  '还想直接记：待办：明天交报告 · 笔记：读到一句很受用的话',
].join('\n');

function QuickCaptureCard({ onSubmitted }: { onSubmitted: () => void }) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<ParsedCaptureItem[] | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const selectedCount = items ? items.length - excluded.size : 0;

  const parseCapture = useApiMutation(
    (text: string) => apiRequest<{ items: ParsedCaptureItem[] }>('post', '/melog/capture/parse', { text })
  );

  const submitCapture = useApiMutation(
    ({ text, exclude }: { text: string; exclude: number[] }) =>
      apiRequest<CaptureSubmitResponse>('post', '/melog/capture', { text, exclude }),
    [['melog/entries'], ['melog/overview']]
  );

  const handleParse = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await parseCapture.mutateAsync(text);
      setItems(res.items || []);
      setExcluded(new Set());
    } catch {
      setFeedback({ ok: false, message: '解析失败，请重试' });
    } finally {
      setBusy(false);
    }
  };

  const toggleItem = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!items) return;
    setBusy(true);
    try {
      const res = await submitCapture.mutateAsync({ text, exclude: [...excluded] });
      setFeedback({
        ok: true,
        message: `已写入：时间线 +${res.created}、健康记录 +${res.healthRecords}、待办 +${res.todos ?? 0}（重复提交会自动去重）`,
      });
      setItems(null);
      setText('');
      onSubmitted();
    } catch {
      setFeedback({ ok: false, message: '提交失败，请重试' });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setItems(null);
    setExcluded(new Set());
    setFeedback(null);
  };

  return (
    <div
      className="rounded-xl p-4 mb-6"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Mic size={14} style={{ color: 'var(--color-text-tertiary)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          口述打卡
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          打开潮汐 / Keep 看完数据，用键盘听写念出来
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={CAPTURE_PLACEHOLDER}
        className="w-full rounded-lg p-3 text-sm outline-none resize-y"
        style={{
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border-light)',
          color: 'var(--color-text-primary)',
        }}
      />
      {!items ? (
        <div className="mt-3">
          <button
            onClick={handleParse}
            disabled={busy || !text.trim()}
            className="px-4 py-1.5 text-xs rounded-lg text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-ink-soft)' }}
          >
            {busy ? '解析中…' : '解析预览'}
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="space-y-1.5">
            {items.map((item) => {
              const meta = CAPTURE_TYPE_META[item.type] || CAPTURE_TYPE_META.note;
              const checked = !excluded.has(item.index);
              return (
                <label
                  key={item.index}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    border: `1px solid ${checked ? 'var(--color-border-light)' : 'transparent'}`,
                    opacity: checked ? 1 : 0.45,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(item.index)}
                    style={{ accentColor: 'var(--color-text-primary)' }}
                  />
                  <meta.icon size={13} style={{ color: meta.color }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {item.title}
                  </span>
                  {item.source && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{item.source}</span>
                  )}
                  <span className="text-[11px] ml-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                    {formatTime(item.occurredAt)}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={handleSubmit}
              disabled={busy || selectedCount === 0}
              className="px-4 py-1.5 text-xs rounded-lg text-white disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-ink-soft)' }}
            >
              {busy ? '提交中…' : `提交 ${selectedCount} 条`}
            </button>
            <button
              onClick={handleReset}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-lg"
              style={{ border: '1px solid var(--color-border-light)', color: 'var(--color-text-tertiary)' }}
            >
              重新编辑
            </button>
            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              将写入 MeLog 时间线与健康记录
            </span>
          </div>
        </div>
      )}
      {feedback && (
        <div className="mt-2 text-xs" style={{ color: feedback.ok ? '#10b981' : '#ef4444' }}>
          {feedback.message}
        </div>
      )}
    </div>
  );
}

export default function Timeline() {
  const [category, setCategory] = useState<MeLogCategory | ''>('');
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (query) params.set('q', query);
  params.set('limit', '100');

  const entriesQuery = useApiQuery<{ entries: MeLogEntryRow[]; total: number }>(
    ['melog/entries', category, query],
    `/melog/entries?${params.toString()}`
  );
  const overviewQuery = useApiQuery<MeLogOverview>(['melog/overview'], '/melog/overview');

  const entries = entriesQuery.data?.entries ?? [];
  const overview = overviewQuery.data ?? null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(keyword.trim());
  };

  const handleRefresh = () => {
    entriesQuery.refetch();
    overviewQuery.refetch();
  };

  const stats = [
    { label: '累计条目', value: overview?.totalEntries ?? 0 },
    { label: '近 7 天', value: overview?.last7Days ?? 0 },
    { label: '近 30 天', value: overview?.last30Days ?? 0 },
    {
      label: '数据源',
      value: `${overview?.sources[0]?.connected ?? 0}/${overview?.sources[0]?.total ?? 0}`,
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
          >
            <div className="text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
              {stat.label}
            </div>
            <div className="text-2xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* 口述打卡 */}
      <QuickCaptureCard onSubmitted={handleRefresh} />

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setCategory('')}
          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
            category === '' ? 'font-medium text-white' : ''
          }`}
          style={
            category === ''
              ? { backgroundColor: 'var(--color-ink-soft)' }
              : { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)', color: 'var(--color-text-tertiary)' }
          }
        >
          全部
        </button>
        {MELOG_CATEGORY_LIST.map((key) => {
          const meta = CATEGORY_META[key];
          const count = overview?.byCategory.find((c) => c.category === key)?.count ?? 0;
          return (
            <button
              key={key}
              onClick={() => setCategory(category === key ? '' : key)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-all"
              style={
                category === key
                  ? { backgroundColor: meta.color, color: '#fff', fontWeight: 500 }
                  : { backgroundColor: meta.bg, color: meta.color }
              }
            >
              <meta.icon size={12} />
              {meta.label}
              <span style={{ opacity: 0.7 }}>{count}</span>
            </button>
          );
        })}

        <form onSubmit={handleSearch} className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索标题、内容、参与者"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg w-52 outline-none"
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>
          <button
            type="submit"
            className="p-2 rounded-lg transition-colors hover:bg-slate-100"
            style={{ color: 'var(--color-text-tertiary)' }}
            title="刷新"
          >
            <RefreshCw size={14} />
          </button>
        </form>
      </div>

      {/* 时间线 */}
      {entriesQuery.isLoading ? (
        <LoadingSpinner />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Radio size={24} strokeWidth={1} />}
          title="时间线还是空的"
          description="在「数据源」标签页接入连接器，或按 MeLog Standard 通过 POST /api/melog/ingest 推送第一批条目"
        />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const meta = CATEGORY_META[(entry.category as MeLogCategory) || 'custom'] || CATEGORY_META.custom;
            return (
              <div
                key={entry.id}
                className="flex gap-3 rounded-xl p-4"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: meta.bg, color: meta.color }}
                >
                  <meta.icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {entry.title}
                    </span>
                    <span
                      className="px-1.5 py-0.5 text-[10px] rounded"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      {meta.label} · {entry.type}
                    </span>
                    {entry.source && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {entry.source.name}
                      </span>
                    )}
                  </div>
                  {entry.content && (
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
                      {entry.actor && <span className="font-medium">{entry.actor}：</span>}
                      {entry.content}
                    </p>
                  )}
                  <div className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {formatTime(entry.occurredAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
