import { useState } from 'react';
import type { MindsetSlogan } from '@meos/shared';
import MockBadge from '../components/MockBadge';
import { isMockItem } from '../lib/mockFlag';
import { apiRequest, useApiMutation, useApiQuery } from '../lib/api-queries';
import { toast } from '../stores/toastStore';

const categories = ['整体置顶', '生活', '工作', '身体', '心理', '物品', '经济'] as const;
type Category = typeof categories[number];

interface SloganForm {
  content: string;
  category: Category;
  order: number;
}

interface MindsetSloganRow extends MindsetSlogan {
  mock?: boolean;
}

export default function MindsetView() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('整体置顶');
  const [showModal, setShowModal] = useState(false);
  const [editingSlogan, setEditingSlogan] = useState<MindsetSlogan | null>(null);
  const [form, setForm] = useState<SloganForm>({
    content: '',
    category: '整体置顶',
    order: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const slogansQuery = useApiQuery<{ slogans: MindsetSloganRow[] }>(['mindsets'], '/mindsets');
  const slogans = slogansQuery.data?.slogans ?? [];

  const createSlogan = useApiMutation(
    (data: SloganForm) => apiRequest('post', '/mindsets', data),
    [['mindsets']]
  );

  const updateSlogan = useApiMutation(
    ({ id, data }: { id: string; data: SloganForm }) => apiRequest('patch', `/mindsets/${id}`, data),
    [['mindsets']]
  );

  const deleteSlogan = useApiMutation(
    (id: string) => apiRequest('delete', `/mindsets/${id}`),
    [['mindsets']]
  );

  const clearSloganMock = useApiMutation(
    (id: string) => apiRequest('patch', `/mindsets/${id}`, { mock: false }),
    [['mindsets']]
  );

  const filteredSlogans = slogans.filter(s => s.category === selectedCategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    setSubmitting(true);
    try {
      if (editingSlogan) {
        await updateSlogan.mutateAsync({ id: editingSlogan.id, data: form });
      } else {
        await createSlogan.mutateAsync(form);
      }
      setShowModal(false);
      setEditingSlogan(null);
      setForm({ content: '', category: selectedCategory, order: 0 });
    } catch {
      toast.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (slogan: MindsetSlogan) => {
    setEditingSlogan(slogan);
    setForm({
      content: slogan.content,
      category: slogan.category as Category,
      order: slogan.order,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这条格言吗？')) return;
    try {
      await deleteSlogan.mutateAsync(id);
    } catch {
      toast.error('删除失败');
    }
  };

  const handleAdd = () => {
    setEditingSlogan(null);
    setForm({ content: '', category: selectedCategory, order: 0 });
    setShowModal(true);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (slogansQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <p className="text-sm text-slate-400">管理你的心态格言，建立内在操作系统</p>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] text-white text-sm font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-slate-900/10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加格言
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => {
          const count = slogans.filter(s => s.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-[var(--color-ink-soft)] text-white'
                  : 'bg-[var(--color-surface)] text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {cat}
              {count > 0 && <span className="ml-1.5 opacity-50">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filteredSlogans.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-xl border border-dashed border-slate-200 p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 mb-1">暂无{selectedCategory}类格言</p>
            <button onClick={handleAdd} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
              添加第一条格言
            </button>
          </div>
        ) : (
          filteredSlogans.map((slogan) => (
            <div
              key={slogan.id}
              className="group bg-[var(--color-surface)] rounded-xl border border-slate-100 p-5 hover:border-slate-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-base text-slate-900 leading-relaxed flex items-center gap-2">
                    {slogan.content}
                    {isMockItem(slogan) && (
                      <MockBadge
                        onClick={async () => {
                          await clearSloganMock.mutateAsync(slogan.id);
                        }}
                      />
                    )}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span>创建 {formatDate(slogan.createdAt)}</span>
                    {slogan.updatedAt !== slogan.createdAt && (
                      <span>修改 {formatDate(slogan.updatedAt)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(slogan)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 13.4a2.2 2.2 0 0 1-.78-.98l-3.5-4.6a2 2 0 0 1 0-2.38l.64-.75a2.2 2.2 0 0 1 3.12-.06l2.28 2.54a2.2 2.2 0 0 1 .5 1.56l-1.08 2.86a2.2 2.2 0 0 1-1.9 1.22z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(slogan.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px]" onClick={() => { setShowModal(false); setEditingSlogan(null); }} />
          <div className="relative bg-[var(--color-surface)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] w-full max-w-md overflow-hidden" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <div className="px-6 py-5 border-b border-slate-50">
              <h2 className="text-lg font-medium text-slate-900">{editingSlogan ? '编辑格言' : '添加格言'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">分类</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:border-slate-200 focus:bg-[var(--color-surface)] transition-all"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">格言内容</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:border-slate-200 focus:bg-[var(--color-surface)] transition-all resize-none"
                  placeholder="输入你的心态格言..."
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-2">排序权重</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                  min={0}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:border-slate-200 focus:bg-[var(--color-surface)] transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingSlogan(null); }}
                  className="flex-1 px-4 py-3 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting || !form.content.trim()}
                  className="flex-1 px-4 py-3 text-sm font-medium text-white bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] rounded-lg transition-all disabled:opacity-50"
                >
                  {submitting ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
