import { useState } from 'react';
import { Plus, X, ExternalLink } from 'lucide-react';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import MockBadge, { MockClaimField } from '../../components/MockBadge';
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS, CONTENT_TYPE_ICONS, PRIORITY_LABELS } from './constants';
import type { BrandPillar, ContentDistribution, ContentItem, ContentStatus, PlatformChannel } from '@meos/shared';
import { toast } from '../../stores/toastStore';

const COLUMNS = ['idea', 'drafting', 'ready', 'published'] as const;

// 列表端点（GET /brand/contents）返回 `_count.distributions` 而非 distributions 数组（数组仅在详情端点返回）
type ContentListItem = ContentItem & { _count?: { distributions: number } };

interface TopicOption {
  id: string;
  title: string;
}

interface ContentsResponse {
  contents: ContentListItem[];
}

interface ChannelsResponse {
  channels: PlatformChannel[];
}

interface PillarsResponse {
  pillars: BrandPillar[];
}

interface TopicsResponse {
  topics: TopicOption[];
}

const emptyForm = {
  title: '',
  type: 'article',
  priority: 'medium',
  pillarId: '',
  topicId: '',
  publishDue: '',
  coreMessage: '',
  outline: '',
  reviewNote: '',
  isMock: false,
};

export default function Pipeline() {
  const contentsQuery = useApiQuery<ContentsResponse>(['brand/contents'], '/brand/contents');
  const channelsQuery = useApiQuery<ChannelsResponse>(['brand/channels'], '/brand/channels');
  const pillarsQuery = useApiQuery<PillarsResponse>(['brand/pillars'], '/brand/pillars');
  const topicsQuery = useApiQuery<TopicsResponse>(['topics'], '/topics');

  const contents = contentsQuery.data?.contents ?? [];
  const channels = channelsQuery.data?.channels ?? [];
  const pillars = pillarsQuery.data?.pillars ?? [];
  const topics = topicsQuery.data?.topics ?? [];

  const [quickTitle, setQuickTitle] = useState('');
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const createContent = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/brand/contents', data), [
    ['brand/contents'],
    ['brand/overview'],
  ]);
  const updateContent = useApiMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/brand/contents/${id}`, data),
    [['brand/contents'], ['brand/overview']]
  );
  const deleteContent = useApiMutation((id: string) => apiRequest('delete', `/brand/contents/${id}`), [
    ['brand/contents'],
    ['brand/overview'],
  ]);
  const addDistribution = useApiMutation(
    ({ contentId, channelId }: { contentId: string; channelId: string }) =>
      apiRequest('post', `/brand/contents/${contentId}/distributions`, { channelId }),
    [['brand/contents'], ['brand/overview']]
  );
  const patchDistribution = useApiMutation(
    ({ distId, data }: { distId: string; data: Record<string, unknown> }) =>
      apiRequest('patch', `/brand/distributions/${distId}`, data),
    [['brand/contents'], ['brand/overview']]
  );
  const deleteDistribution = useApiMutation((distId: string) => apiRequest('delete', `/brand/distributions/${distId}`), [
    ['brand/contents'],
    ['brand/overview'],
  ]);

  // 详情按需拉取，结果直接驱动弹窗表单（沿用命令式流程，避免查询副作用覆盖未保存的表单输入）
  const openDetail = async (content: ContentItem) => {
    try {
      const res = await apiRequest<{ content: ContentItem }>('get', `/brand/contents/${content.id}`);
      const full: ContentItem = res.content;
      setEditing(full);
      setForm({
        title: full.title,
        type: full.type,
        priority: full.priority,
        pillarId: full.pillarId || '',
        topicId: full.topicId || '',
        publishDue: full.publishDue ? full.publishDue.slice(0, 10) : '',
        coreMessage: full.coreMessage || '',
        outline: full.outline || '',
        reviewNote: full.reviewNote || '',
        isMock: !!full.isMock,
      });
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleQuickAdd = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    try {
      await createContent.mutateAsync({ title });
      setQuickTitle('');
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      await updateContent.mutateAsync({
        id: editing.id,
        data: {
          title: form.title,
          type: form.type,
          priority: form.priority,
          pillarId: form.pillarId || null,
          topicId: form.topicId || null,
          publishDue: form.publishDue || null,
          coreMessage: form.coreMessage || null,
          outline: form.outline || null,
          reviewNote: form.reviewNote || null,
          isMock: form.isMock,
        },
      });
      setEditing(null);
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    try {
      await deleteContent.mutateAsync(editing.id);
      setEditing(null);
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleStatus = async (content: ContentItem, status: ContentStatus) => {
    try {
      await updateContent.mutateAsync({ id: content.id, data: { status } });
      setEditing((prev) => (prev ? { ...prev, status } : prev));
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleAddDistribution = async (contentId: string, channelId: string) => {
    try {
      await addDistribution.mutateAsync({ contentId, channelId });
      await openDetail({ ...editing!, id: contentId } as ContentItem);
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handlePatchDistribution = async (dist: ContentDistribution, payload: Record<string, unknown>) => {
    try {
      await patchDistribution.mutateAsync({ distId: dist.id, data: payload });
      if (editing) await openDetail(editing);
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleDeleteDistribution = async (distId: string) => {
    try {
      await deleteDistribution.mutateAsync(distId);
      if (editing) await openDetail(editing);
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  if (contentsQuery.isLoading || channelsQuery.isLoading || pillarsQuery.isLoading || topicsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="card p-4 mb-6 flex gap-2">
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleQuickAdd();
            }
          }}
          placeholder="记一个选题，回车入池..."
          className="flex-1 text-sm bg-transparent outline-none"
          style={{ color: 'var(--color-text-primary)' }}
        />
        <button onClick={handleQuickAdd} disabled={!quickTitle.trim()} className="btn btn-primary text-sm">
          <Plus size={14} /> 入池
        </button>
      </div>

      {contents.length === 0 ? (
        <EmptyState icon={<Plus size={28} />} title="选题池是空的" description="上面输入框记下第一个选题" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((status) => {
            const items = contents.filter((c) => c.status === status);
            const archived = contents.filter((c) => c.status === 'archived').length;
            return (
              <div key={status}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                    {CONTENT_STATUS_LABELS[status]} · {items.length}
                  </span>
                  {status === 'published' && archived > 0 && (
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      归档 {archived}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {items.map((content) => {
                    const Icon = CONTENT_TYPE_ICONS[content.type] || CONTENT_TYPE_ICONS.other;
                    return (
                      <button
                        key={content.id}
                        onClick={() => openDetail(content)}
                        className="card p-3 w-full text-left hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={12} className="text-slate-400" />
                          <span className="text-xs text-slate-400">{CONTENT_TYPE_LABELS[content.type]}</span>
                          {content.priority === 'high' && (
                            <span className="text-xs px-1.5 rounded bg-red-50 text-red-600">{PRIORITY_LABELS.high}</span>
                          )}
                          {content.isMock && <MockBadge className="ml-auto" />}
                        </div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {content.title}
                        </p>
                        {content.publishDue && (
                          <p className="text-xs mt-1 text-amber-600">计划 {content.publishDue.slice(0, 10)}</p>
                        )}
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                          {content._count?.distributions ?? 0} 个渠道
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="内容详情" maxWidth="max-w-2xl">
        {editing && (
          <div className="space-y-4">
            <FormField label="标题" required>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="input"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="类型">
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="input"
                >
                  {Object.entries(CONTENT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="优先级">
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className="input"
                >
                  {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="内容支柱">
                <select
                  value={form.pillarId}
                  onChange={(e) => setForm((f) => ({ ...f, pillarId: e.target.value }))}
                  className="input"
                >
                  <option value="">未挂靠</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="关联课题（认知板块）">
                <select
                  value={form.topicId}
                  onChange={(e) => setForm((f) => ({ ...f, topicId: e.target.value }))}
                  className="input"
                >
                  <option value="">不关联</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="计划发布日">
                <input
                  type="date"
                  value={form.publishDue}
                  onChange={(e) => setForm((f) => ({ ...f, publishDue: e.target.value }))}
                  className="input"
                />
              </FormField>
              <FormField label="当前状态">
                <select
                  value={editing.status}
                  onChange={(e) => handleStatus(editing, e.target.value as ContentStatus)}
                  className="input"
                >
                  {Object.entries(CONTENT_STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="核心观点">
              <input
                type="text"
                value={form.coreMessage}
                onChange={(e) => setForm((f) => ({ ...f, coreMessage: e.target.value }))}
                placeholder="这条内容要让读者记住的一句话"
                className="input"
              />
            </FormField>
            <FormField label="大纲 / 脚本要点">
              <textarea
                value={form.outline}
                onChange={(e) => setForm((f) => ({ ...f, outline: e.target.value }))}
                rows={5}
                className="input resize-none"
              />
            </FormField>
            <FormField label="发布复盘（什么有效 / 下次改进）">
              <textarea
                value={form.reviewNote}
                onChange={(e) => setForm((f) => ({ ...f, reviewNote: e.target.value }))}
                rows={3}
                className="input resize-none"
              />
            </FormField>

            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">分发矩阵（一鱼多吃）</p>
              <div className="space-y-2">
                {channels.map((channel) => {
                  const dist = editing.distributions?.find((d) => d.channelId === channel.id);
                  return (
                    <div key={channel.id} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium flex items-center gap-1.5">
                          {channel.name}
                          {dist?.isMock && (
                            <MockBadge onClick={() => handlePatchDistribution(dist, { isMock: false })} />
                          )}
                        </span>
                        {dist ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: dist.status === 'published' ? '#10b981' : 'var(--color-text-tertiary)' }}>
                              {dist.status === 'published' ? '已发布' : '计划中'}
                            </span>
                            {dist.status !== 'published' && (
                              <button
                                onClick={() => handlePatchDistribution(dist, { status: 'published' })}
                                className="btn btn-primary text-xs px-2 py-1"
                              >
                                标记发布
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteDistribution(dist.id)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label="删除分发记录"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddDistribution(editing.id, channel.id)}
                            className="btn text-xs px-2 py-1"
                            style={{ border: '1px solid var(--color-border, #e2e8f0)' }}
                          >
                            <Plus size={12} /> 加入分发
                          </button>
                        )}
                      </div>
                      {dist && (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            defaultValue={dist.adaptedTitle || ''}
                            placeholder="平台适配标题"
                            className="text-xs px-2 py-1 rounded border bg-[var(--color-surface)]"
                            onBlur={(e) => {
                              if (e.target.value !== (dist.adaptedTitle || '')) {
                                handlePatchDistribution(dist, { adaptedTitle: e.target.value || null });
                              }
                            }}
                          />
                          <input
                            type="text"
                            defaultValue={dist.url || ''}
                            placeholder="发布链接"
                            className="text-xs px-2 py-1 rounded border bg-[var(--color-surface)]"
                            onBlur={(e) => {
                              if (e.target.value !== (dist.url || '')) {
                                handlePatchDistribution(dist, { url: e.target.value || null });
                              }
                            }}
                          />
                          <input
                            type="number"
                            defaultValue={dist.views ?? ''}
                            placeholder="阅读/播放"
                            className="text-xs px-2 py-1 rounded border bg-[var(--color-surface)]"
                            onBlur={(e) => {
                              const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                              if (v !== dist.views) handlePatchDistribution(dist, { views: v });
                            }}
                          />
                          <input
                            type="number"
                            defaultValue={dist.likes ?? ''}
                            placeholder="点赞"
                            className="text-xs px-2 py-1 rounded border bg-[var(--color-surface)]"
                            onBlur={(e) => {
                              const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                              if (v !== dist.likes) handlePatchDistribution(dist, { likes: v });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {channels.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    还没有渠道，先到「渠道与数据」添加平台账号
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-600">
                删除内容
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)} className="btn text-sm">
                  取消
                </button>
                <button onClick={handleSave} className="btn btn-primary text-sm">
                  <ExternalLink size={14} /> 保存
                </button>
              </div>
            </div>
            <MockClaimField isMock={form.isMock} onChange={(v) => setForm((f) => ({ ...f, isMock: v }))} />
          </div>
        )}
      </Modal>
    </div>
  );
}
