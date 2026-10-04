import { useState } from 'react';
import { Trash2, Clock, History } from 'lucide-react';
import type { BalanceWheelScore, Domain } from '@meos/shared';
import LoadingSpinner from './LoadingSpinner';
import { DomainIconMini } from './DomainIcon';
import RadarChart from './charts/RadarChart';
import { apiRequest, useApiMutation, useApiQuery } from '../lib/api-queries';
import { toast } from '../stores/toastStore';

export default function BalanceWheelView() {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const domainsQuery = useApiQuery<{ domains: Domain[] }>(['domains'], '/domains');
  const historyQuery = useApiQuery<{ scores: BalanceWheelScore[] }>(
    ['balance-wheel/history'],
    '/balance-wheel/history?limit=20',
    { enabled: showHistory }
  );

  const domains = domainsQuery.data?.domains ?? [];
  const history = historyQuery.data?.scores ?? [];

  const saveScores = useApiMutation(
    (scores: { domainId: string; score: number }[]) =>
      apiRequest('post', '/balance-wheel/scores', { scores }),
    [['balance-wheel/history']]
  );

  const deleteScore = useApiMutation(
    (id: string) => apiRequest('delete', `/balance-wheel/scores/${id}`),
    [['balance-wheel/history']]
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const scoreData = Object.entries(scores).map(([domainId, score]) => ({
        domainId,
        score,
      }));
      await saveScores.mutateAsync(scoreData);
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除这条评分记录？')) return;
    setDeleting(id);
    try {
      await deleteScore.mutateAsync(id);
    } finally {
      setDeleting(null);
    }
  };

  const chartData = domains.map((domain) => ({
    domain: domain.name,
    score: scores[domain.id] || 5,
  }));

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (domainsQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-32">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-3xl mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--color-text-primary)',
            }}
          >
            生活平衡轮
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            为各个生活领域打分（1-10分），可视化你的生活平衡状态
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`text-sm font-medium rounded-lg px-4 py-2.5 inline-flex items-center gap-2 ${
            showHistory ? 'bg-[var(--color-bg-secondary)]' : ''
          }`}
          style={showHistory ? { backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' } : { color: 'var(--color-text-tertiary)' }}
        >
          <History size={16} />
          {showHistory ? '关闭历史' : '查看历史'}
        </button>
      </div>

      {showHistory ? (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="card p-8 text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              暂无历史记录
            </div>
          ) : (
            history.map((record) => (
              <div key={record.id} className="card p-5 group flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  {record.domain?.icon ? (
                    <DomainIconMini icon={record.domain.icon} domainName={record.domain?.name} size={32} />
                  ) : (
                    <Clock size={18} style={{ color: 'var(--color-text-tertiary)' }} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{record.domain?.name || '未知领域'}</span>
                    <span className="text-lg" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--color-text-primary)' }}>{record.score}分</span>
                  </div>
                  {record.note && <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{record.note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{formatDate(record.createdAt)}</span>
                  <button
                    onClick={() => handleDelete(record.id)}
                    disabled={deleting === record.id}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--color-error)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>平衡轮可视化</h2>
            <RadarChart data={chartData.map((d) => ({ label: d.domain, value: d.score }))} max={10} />
          </div>

          <div className="card p-6">
            <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>领域评分</h2>
            <div className="space-y-5">
              {domains.map((domain) => (
                <div key={domain.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-2.5 w-32">
                    <DomainIconMini icon={domain.icon || ''} domainName={domain.name} size={28} />
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>{domain.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={scores[domain.id] || 5}
                      onChange={(e) => setScores({ ...scores, [domain.id]: parseInt(e.target.value) })}
                      className="flex-1 h-1 bg-[var(--color-bg-tertiary)] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-ink-soft)]"
                    />
                    <span className="text-lg w-6 text-center tabular-nums" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--color-text-primary)' }}>
                      {scores[domain.id] || 5}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-6 w-full btn btn-primary"
            >
              {submitting ? '保存中...' : '保存评分'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
