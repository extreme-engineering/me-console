import { useState } from 'react';
import { Plus, Trash2, TerminalSquare, X, KeyRound } from 'lucide-react';
import type { MeLogSource } from '@meos/shared';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import {
  ADAPTER_PRESETS,
  CATEGORY_META,
  MELOG_CATEGORY_LIST,
  SOURCE_STATUS_META,
  formatTime,
  type MeLogCategory,
} from './meta';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';

interface TokenRow {
  id: string;
  name: string;
  sourceId?: string;
  lastUsedAt?: string;
  createdAt: string;
  source?: { name: string; adapter: string };
}

export default function Sources() {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ name: string; category: MeLogCategory; adapter: string; endpoint: string }>({
    name: '',
    category: 'im',
    adapter: 'chatlog',
    endpoint: '',
  });

  const sourcesQuery = useApiQuery<{ sources: MeLogSource[] }>(['melog/sources'], '/melog/sources');
  const sources = sourcesQuery.data?.sources ?? [];

  const createSource = useApiMutation(
    (data: { name: string; category: MeLogCategory; adapter: string; endpoint?: string }) =>
      apiRequest('post', '/melog/sources', data),
    [['melog/sources']]
  );

  const deleteSource = useApiMutation(
    (id: string) => apiRequest('delete', `/melog/sources/${id}`),
    [['melog/sources']]
  );

  const handleAdapterChange = (adapter: string) => {
    const preset = ADAPTER_PRESETS.find((p) => p.adapter === adapter);
    setForm((prev) => ({
      ...prev,
      adapter,
      category: preset?.category || prev.category,
      name: prev.name || preset?.name || '',
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createSource.mutateAsync({
        name: form.name.trim(),
        category: form.category,
        adapter: form.adapter,
        endpoint: form.endpoint.trim() || undefined,
      });
      setForm({ name: '', category: 'im', adapter: 'chatlog', endpoint: '' });
      setShowForm(false);
    } catch (err) {
      const message =
        err instanceof Error && 'response' in err
          ? ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? '创建失败')
          : '创建失败';
      setError(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('删除数据源会同时删除其全部条目，确定继续吗？')) return;
    try {
      await deleteSource.mutateAsync(id);
    } catch {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          连接器按 MeLog Standard 把外部数据推送到统一时间线；MeOS 本地存储，不做云端转发
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-ink-soft)' }}
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? '取消' : '接入数据源'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl p-4 mb-6"
          style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
        >
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                连接器类型
              </span>
              <select
                value={form.adapter}
                onChange={(e) => handleAdapterChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-light)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {ADAPTER_PRESETS.map((preset) => (
                  <option key={preset.adapter} value={preset.adapter}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] block mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                {ADAPTER_PRESETS.find((p) => p.adapter === form.adapter)?.description}
              </span>
            </label>

            <label className="block">
              <span className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                显示名称
              </span>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                placeholder="如：微信聊天记录"
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-light)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </label>

            <label className="block">
              <span className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                分类
              </span>
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as MeLogCategory }))}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-light)',
                  color: 'var(--color-text-primary)',
                }}
              >
                {MELOG_CATEGORY_LIST.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_META[category].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                连接器地址（可选，仅作登记）
              </span>
              <input
                value={form.endpoint}
                onChange={(e) => setForm((prev) => ({ ...prev, endpoint: e.target.value }))}
                placeholder="http://localhost:5030"
                className="w-full px-3 py-2 text-sm rounded-lg outline-none"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-light)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </label>
          </div>

          {error && (
            <p className="text-xs text-red-500 mb-3">{error}</p>
          )}

          <button
            type="submit"
            className="px-4 py-2 text-xs rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-ink-soft)' }}
          >
            创建数据源
          </button>
        </form>
      )}

      {sourcesQuery.isLoading ? (
        <LoadingSpinner />
      ) : sources.length === 0 ? (
        <EmptyState
          icon={<TerminalSquare size={24} strokeWidth={1} />}
          title="还没有接入任何数据源"
          description="从「微信聊天记录 + 健康导出」开始，跑通第一条数据到时间线的链路"
          action={
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-xs rounded-lg text-white"
              style={{ backgroundColor: 'var(--color-ink-soft)' }}
            >
              接入第一个数据源
            </button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {sources.map((source) => {
            const status = SOURCE_STATUS_META[source.status] || SOURCE_STATUS_META.disconnected;
            const meta = CATEGORY_META[(source.category as MeLogCategory) || 'custom'] || CATEGORY_META.custom;
            return (
              <div
                key={source.id}
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {source.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {source.adapter}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors"
                    title="删除数据源"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="text-xs space-y-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  <div>
                    {meta.label} · {status.label} · {source.entryCount} 条
                  </div>
                  <div>最近同步：{formatTime(source.lastSyncAt)}</div>
                  {source.endpoint && <div className="truncate">地址：{source.endpoint}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 接入提示 */}
      <div
        className="rounded-xl p-4 mt-6"
        style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px dashed var(--color-border-light)' }}
      >
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          连接器如何推送数据（MeLog Standard Ingest API，推荐用下方令牌鉴权）
        </div>
        <pre
          className="text-[11px] overflow-x-auto whitespace-pre-wrap"
          style={{ color: 'var(--color-text-tertiary)' }}
        >{`curl -X POST http://localhost:3001/api/melog/ingest \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer melt_xxx" \\
  -d '{
    "sourceId": "绑定令牌的数据源 ID",
    "entries": [{
      "externalId": "msg-001",
      "category": "im",
      "type": "chat-message",
      "title": "与妈妈的对话",
      "content": "周末回家吃饭",
      "actor": "妈妈",
      "occurredAt": "2026-09-04T10:00:00Z"
    }]
  }'`}</pre>
      </div>

      {/* 连接器令牌 */}
      <TokenManager sources={sources} />
    </div>
  );
}

function TokenManager({ sources }: { sources: MeLogSource[] }) {
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [freshSecret, setFreshSecret] = useState('');
  const [show, setShow] = useState(false);

  const tokensQuery = useApiQuery<{ tokens: TokenRow[] }>(['melog/tokens'], '/melog/tokens');
  const tokens = tokensQuery.data?.tokens ?? [];

  const createToken = useApiMutation(
    (data: { name: string; sourceId?: string }) =>
      apiRequest<{ secret: string }>('post', '/melog/tokens', data),
    [['melog/tokens']]
  );

  const revokeToken = useApiMutation(
    (id: string) => apiRequest('delete', `/melog/tokens/${id}`),
    [['melog/tokens']]
  );

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await createToken.mutateAsync({
        name: name.trim(),
        ...(sourceId ? { sourceId } : {}),
      });
      setFreshSecret(res.secret);
      setName('');
      setSourceId('');
    } catch {}
  };

  const revoke = async (id: string) => {
    if (!confirm('吊销后使用该令牌的脚本将立即失效，确定？')) return;
    try {
      await revokeToken.mutateAsync(id);
    } catch {}
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          连接器令牌
        </h3>
        <button
          onClick={() => setShow(!show)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors hover:bg-slate-100"
          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-light)' }}
        >
          {show ? <X size={12} /> : <KeyRound size={12} />}
          {show ? '收起' : '新建令牌'}
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
        令牌只允许调用 ingest 写入（可绑定单一数据源），不能访问其他 API；明文只显示一次，泄露即吊销
      </p>

      {show && (
        <form onSubmit={create} className="flex flex-wrap items-center gap-2 mb-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="令牌名称，如 导入脚本"
            className="px-3 py-1.5 text-xs rounded-lg outline-none w-44"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text-primary)',
            }}
          />
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg outline-none"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <option value="">可写任意数据源</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                仅限：{source.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs rounded-lg text-white"
            style={{ backgroundColor: 'var(--color-text-primary)' }}
          >
            生成令牌
          </button>
        </form>
      )}

      {freshSecret && (
        <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
          <div className="text-xs mb-1" style={{ color: '#065f46' }}>
            新令牌明文（仅显示这一次，立即复制保存）：
          </div>
          <code className="text-xs break-all" style={{ color: '#065f46' }}>
            {freshSecret}
          </code>
          <button
            className="ml-3 text-xs underline"
            style={{ color: '#065f46' }}
            onClick={() => setFreshSecret('')}
          >
            我已保存
          </button>
        </div>
      )}

      {tokens.length > 0 && (
        <div className="space-y-2">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5"
              style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}
            >
              <KeyRound size={12} className="text-slate-400" />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                {token.name}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {token.source ? `仅限 ${token.source.name}` : '任意数据源'} · 最近使用 {formatTime(token.lastUsedAt)}
              </span>
              <button
                onClick={() => revoke(token.id)}
                className="ml-auto p-1 rounded text-slate-300 hover:text-red-500 transition-colors"
                title="吊销令牌"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
