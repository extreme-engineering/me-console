import { useState } from 'react';
import { useApiQuery } from '../../lib/api-queries';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import BarChart from '../../components/charts/BarChart';
import type { BrandOverview } from '@meos/shared';

type MetricKey = 'followersDelta' | 'views' | 'likes' | 'comments' | 'shares';

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'followersDelta', label: '粉丝', color: '#6366f1' },
  { key: 'views', label: '播放/阅读', color: '#10b981' },
  { key: 'likes', label: '点赞', color: '#8b5cf6' },
  { key: 'comments', label: '评论', color: '#f59e0b' },
  { key: 'shares', label: '分享', color: '#ef4444' },
];

const fmt = (n: number) => (n === 0 ? '—' : n.toLocaleString());

export default function Analytics() {
  const overviewQuery = useApiQuery<BrandOverview>(['brand/overview'], '/brand/overview');
  const [metric, setMetric] = useState<MetricKey>('views');

  if (overviewQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }
  const data = overviewQuery.data;
  if (!data) return <EmptyState title="加载失败" description="无法获取总览数据，请确认后端已启动" />;

  const active = METRICS.find((m) => m.key === metric)!;
  const chartData = [...data.weeklyTrend].reverse().map((w) => ({ label: w.label, value: w[metric] }));
  const weekTotals = data.weeklyTrend.reduce(
    (acc, w) => {
      acc.followersDelta += w.followersDelta;
      acc.views += w.views;
      acc.likes += w.likes;
      acc.comments += w.comments;
      acc.shares += w.shares;
      return acc;
    },
    { followersDelta: 0, views: 0, likes: 0, comments: 0, shares: 0 },
  );

  return (
    <div className="page-enter space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {METRICS.map((m) => (
          <div key={m.key} className="card p-4">
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-tertiary)' }}>
              近 12 周{m.label}
            </p>
            <p className="text-xl font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {fmt(weekTotals[m.key])}
            </p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">12 周趋势（7 天一桶）</h3>
          <div className="flex gap-1">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className="text-xs px-2 py-1 rounded-full transition-all"
                style={{
                  backgroundColor: metric === m.key ? m.color : 'var(--color-bg-secondary)',
                  color: metric === m.key ? '#fff' : 'var(--color-text-primary)',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            暂无快照数据，先去「渠道与数据」录入
          </p>
        ) : (
          <BarChart data={chartData} xKey="label" valueKey="value" color={active.color} />
        )}
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-medium mb-3">渠道健康</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--color-text-tertiary)' }}>
                <th className="text-left font-normal pb-2">渠道</th>
                <th className="text-right font-normal pb-2">最新粉丝</th>
                <th className="text-right font-normal pb-2">较上次</th>
                <th className="text-right font-normal pb-2">快照数</th>
                <th className="text-right font-normal pb-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((c) => (
                <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-border, #e2e8f0)' }}>
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 text-right">{c.latest ? c.latest.followers.toLocaleString() : '—'}</td>
                  <td
                    className="py-2 text-right"
                    style={{ color: c.followerDelta === null ? undefined : c.followerDelta >= 0 ? '#10b981' : '#ef4444' }}
                  >
                    {c.followerDelta === null ? '—' : `${c.followerDelta >= 0 ? '+' : ''}${c.followerDelta}`}
                  </td>
                  <td className="py-2 text-right">{c.snapshotCount}</td>
                  <td className="py-2 text-right">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}