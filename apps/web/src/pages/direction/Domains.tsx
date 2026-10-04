import { useState } from 'react';
import { Plus, Edit2, Trash2, Check } from 'lucide-react';
import type { Domain } from '@meos/shared';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import BalanceWheelView from '../../components/BalanceWheelView';
import DomainIcon, { DOMAIN_ICON_PRESETS } from '../../components/DomainIcon';

interface DomainsResponse {
  domains?: Domain[];
}

interface DomainFormData {
  name: string;
  identifier: string;
  icon: string;
  weight: number;
  description: string;
}

const emptyForm: DomainFormData = {
  name: '',
  identifier: '',
  icon: 'career',
  weight: 1,
  description: '',
};

export default function Domains() {
  const domainsQuery = useApiQuery<DomainsResponse>(['domains'], '/domains');
  const domains = domainsQuery.data?.domains ?? [];
  const [showModal, setShowModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [form, setForm] = useState<DomainFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'manage' | 'balance'>('manage');

  const createDomain = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/domains', data), [['domains'], ['goals']]);
  const updateDomain = useApiMutation(({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/domains/${id}`, data), [['domains'], ['goals']]);
  const deleteDomain = useApiMutation((id: string) => apiRequest('delete', `/domains/${id}`), [['domains'], ['goals']]);

  const openCreate = () => {
    setEditingDomain(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (domain: Domain) => {
    setEditingDomain(domain);
    setForm({
      name: domain.name,
      identifier: domain.identifier,
      icon: domain.icon || 'career',
      weight: domain.weight || 1,
      description: domain.description ?? '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.identifier.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        identifier: form.identifier.trim(),
        icon: form.icon,
        weight: form.weight,
        description: form.description.trim() || undefined,
      };
      if (editingDomain) {
        await updateDomain.mutateAsync({ id: editingDomain.id, data: payload });
      } else {
        await createDomain.mutateAsync(payload);
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditingDomain(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除这个领域？关联的目标和习惯不会被删除，但会解除关联。')) return;
    setDeleting(id);
    try {
      await deleteDomain.mutateAsync(id);
    } finally {
      setDeleting(null);
    }
  };

  if (domainsQuery.isLoading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-32">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light text-slate-900 tracking-tight">领域与平衡</h1>
          <p className="text-sm text-slate-400 mt-1">管理生活领域，评估平衡状态</p>
        </div>
        {activeTab === 'manage' && (
          <button
            onClick={openCreate}
            className="bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] text-white text-sm font-medium rounded-lg px-4 py-2.5 inline-flex items-center gap-2"
          >
            <Plus size={16} />
            新增领域
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('manage')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'manage'
              ? 'bg-[var(--color-surface)] text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          领域管理
        </button>
        <button
          onClick={() => setActiveTab('balance')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'balance'
              ? 'bg-[var(--color-surface)] text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          平衡轮
        </button>
      </div>

      {activeTab === 'balance' ? (
        <BalanceWheelView />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {domains.length === 0 && (
          <div className="col-span-2 bg-[var(--color-surface)] rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
            暂无领域，点击上方按钮添加
          </div>
        )}
        {domains.map((domain) => (
          <div
            key={domain.id}
            className="bg-[var(--color-surface)] rounded-xl border border-slate-100 p-5 group hover:border-slate-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <DomainIcon
                  icon={domain.icon ?? ''}
                  domainName={domain.name}
                  size={48}
                  variant="circle"
                />
                <div>
                  <h3 className="text-base font-medium text-slate-900">{domain.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{domain.identifier}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">权重</p>
                  <p className="text-2xl font-light text-slate-900 mt-0.5">{domain.weight}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button
                    onClick={() => openEdit(domain)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(domain.id)}
                    disabled={deleting === domain.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
            {domain.description && (
              <p className="mt-3 text-sm text-slate-500 pl-1">{domain.description}</p>
            )}
          </div>
        ))}
      </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingDomain ? '编辑领域' : '新增领域'}
        maxWidth="max-w-md"
      >
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300"
              placeholder="领域名称"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">标识符 (英文)</label>
            <input
              type="text"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300"
              placeholder="如: career, health"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">图标</label>
            <div className="grid grid-cols-6 gap-2">
              {DOMAIN_ICON_PRESETS.map((preset) => {
                const isSelected = form.icon === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => setForm({ ...form, icon: preset.key })}
                    className={`relative flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all border ${
                      isSelected
                        ? 'border-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]'
                        : 'border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                    title={preset.label}
                  >
                    <DomainIcon icon={preset.key} size={32} variant="circle" />
                    <span className="text-[10px] truncate w-full text-center" style={{ color: 'var(--color-text-tertiary)' }}>
                      {preset.label}
                    </span>
                    {isSelected && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-ink-soft)' }}>
                        <Check size={10} color="#fff" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">权重 (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 1 })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-slate-300 resize-none"
              placeholder="领域描述（可选）"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 rounded-lg"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.name.trim() || !form.identifier.trim()}
            className="bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] text-white text-sm font-medium rounded-lg px-5 py-2.5 disabled:opacity-50"
          >
            {editingDomain ? '保存' : '创建'}
          </button>
        </div>
      </Modal>
    </div>
  );
}