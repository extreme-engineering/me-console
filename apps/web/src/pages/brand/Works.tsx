import { useState } from 'react';
import { Plus, ExternalLink } from 'lucide-react';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import MockBadge, { MockClaimField } from '../../components/MockBadge';
import { WORK_TYPE_LABELS, WORK_TYPE_ICONS, WORK_STATUS_LABELS, WORK_STATUS_ORDER } from './constants';
import type { Work } from '@meos/shared';
import { toast } from '../../stores/toastStore';

const emptyForm = {
  name: '',
  type: 'book',
  status: 'concept',
  description: '',
  progress: '',
  url: '',
  launchedAt: '',
  isMock: false,
};

interface WorksResponse {
  works: Work[];
}

export default function Works() {
  const worksQuery = useApiQuery<WorksResponse>(['brand/works'], '/brand/works');
  const works = worksQuery.data?.works ?? [];

  const [editing, setEditing] = useState<Work | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const createWork = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/brand/works', data), [
    ['brand/works'],
  ]);
  const updateWork = useApiMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/brand/works/${id}`, data),
    [['brand/works']]
  );
  const deleteWork = useApiMutation((id: string) => apiRequest('delete', `/brand/works/${id}`), [['brand/works']]);

  const openCreate = () => {
    setForm(emptyForm);
    setCreating(true);
  };

  const openEdit = (work: Work) => {
    setEditing(work);
    setForm({
      name: work.name,
      type: work.type,
      status: work.status,
      description: work.description || '',
      progress: work.progress || '',
      url: work.url || '',
      launchedAt: work.launchedAt ? work.launchedAt.slice(0, 10) : '',
      isMock: !!work.isMock,
    });
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await createWork.mutateAsync({
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        description: form.description || null,
        progress: form.progress || null,
        url: form.url || null,
        launchedAt: form.launchedAt || null,
      });
      setCreating(false);
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      await updateWork.mutateAsync({
        id: editing.id,
        data: {
          name: form.name,
          type: form.type,
          status: form.status,
          description: form.description || null,
          progress: form.progress || null,
          url: form.url || null,
          launchedAt: form.launchedAt || null,
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
      await deleteWork.mutateAsync(editing.id);
      setEditing(null);
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  if (worksQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" />
      </div>
    );
  }

  const renderForm = (isCreate: boolean) => (
    <div className="space-y-4">
      <FormField label="作品名" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="如：《人生操作系统》 / MeOS App"
          className="input"
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="类型">
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="input">
            {Object.entries(WORK_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="状态">
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="input">
            {Object.entries(WORK_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="进度说明">
          <input
            type="text"
            value={form.progress}
            onChange={(e) => setForm((f) => ({ ...f, progress: e.target.value }))}
            placeholder="如：第 3 章 / v0.2 开发中"
            className="input"
          />
        </FormField>
        <FormField label="发布日期">
          <input
            type="date"
            value={form.launchedAt}
            onChange={(e) => setForm((f) => ({ ...f, launchedAt: e.target.value }))}
            className="input"
          />
        </FormField>
      </div>
      <FormField label="链接">
        <input
          type="text"
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="https://"
          className="input"
        />
      </FormField>
      <FormField label="描述">
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
          className="input resize-none"
        />
      </FormField>
      {!isCreate && <MockClaimField isMock={form.isMock} onChange={(v) => setForm((f) => ({ ...f, isMock: v }))} />}
      <div className="flex justify-between">
        {!isCreate && (
          <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-600">
            删除作品
          </button>
        )}
        <button onClick={isCreate ? handleCreate : handleSave} disabled={!form.name.trim()} className="btn btn-primary text-sm ml-auto">
          {isCreate ? '创建作品' : '保存'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-enter">
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="btn btn-primary text-sm">
          <Plus size={14} /> 新作品
        </button>
      </div>

      {works.length === 0 ? (
        <EmptyState
          title="作品库是空的"
          description="书、课程、App、小程序——它们都是品牌的长线资产"
          action={
            <button onClick={openCreate} className="btn btn-primary text-sm">
              添加第一个作品
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {WORK_STATUS_ORDER.map((status) => {
            const items = works.filter((w) => w.status === status);
            if (items.length === 0) return null;
            return (
              <div key={status}>
                <h3 className="text-xs font-medium mb-2 px-1" style={{ color: 'var(--color-text-tertiary)' }}>
                  {WORK_STATUS_LABELS[status]} · {items.length}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((work) => {
                    const Icon = WORK_TYPE_ICONS[work.type] || WORK_TYPE_ICONS.other;
                    return (
                      <button key={work.id} onClick={() => openEdit(work)} className="card p-4 text-left hover:shadow-md transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon size={15} className="text-slate-400" />
                          <span className="text-xs text-slate-400">{WORK_TYPE_LABELS[work.type]}</span>
                          {work.isMock && <MockBadge className="ml-auto" />}
                        </div>
                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                          {work.name}
                        </p>
                        {work.progress && (
                          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            {work.progress}
                          </p>
                        )}
                        {work.url && (
                          <p className="text-xs mt-1 text-indigo-500 flex items-center gap-1">
                            <ExternalLink size={11} /> 链接
                          </p>
                        )}
                        {work.launchedAt && (
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                            发布于 {work.launchedAt.slice(0, 10)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="新作品">
        {renderForm(true)}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="作品详情">
        {renderForm(false)}
      </Modal>
    </div>
  );
}
