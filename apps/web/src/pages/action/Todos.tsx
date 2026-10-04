import { useState } from 'react';
import { Plus, Check, Circle, Clock, Flag, Trash2, Edit2 } from 'lucide-react';
import type { Domain, Goal, Todo } from '@meos/shared';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import MockBadge from '../../components/MockBadge';
import { isMockItem } from '../../lib/mockFlag';
import { toast } from '../../stores/toastStore';

interface TodosResponse { todos: Todo[] }
interface GoalsResponse { goals: Goal[] }
interface DomainsResponse { domains: Domain[] }

type StatusTab = 'inbox' | 'todo' | 'doing' | 'done';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'todo', label: 'Todo' },
  { key: 'doing', label: 'Doing' },
  { key: 'done', label: 'Done' },
];

const PRIORITY_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  urgent: { bg: '#FEE2E2', color: '#DC2626', label: '紧急' },
  high: { bg: '#FFEDD5', color: '#EA580C', label: '高' },
  medium: { bg: '#F1F5F9', color: '#64748B', label: '中' },
  low: { bg: '#F9FAFB', color: '#9CA3AF', label: '低' },
};

interface TodoFormData {
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  dueDate: string;
  goalId: string;
  domainId: string;
}

const emptyForm: TodoFormData = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  goalId: '',
  domainId: '',
};

export default function Todos() {
  const todosQuery = useApiQuery<TodosResponse>(['todos'], '/todos');
  const goalsQuery = useApiQuery<GoalsResponse>(['goals'], '/goals');
  const domainsQuery = useApiQuery<DomainsResponse>(['domains'], '/domains');

  const [activeTab, setActiveTab] = useState<StatusTab>('inbox');
  const [showModal, setShowModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [form, setForm] = useState<TodoFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const todos = todosQuery.data?.todos ?? [];
  const goals = goalsQuery.data?.goals ?? [];
  const domains = domainsQuery.data?.domains ?? [];

  const createTodo = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/todos', data), [['todos'], ['goals']]);
  const updateTodo = useApiMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/todos/${id}`, data),
    [['todos'], ['goals']]
  );
  const deleteTodo = useApiMutation((id: string) => apiRequest('delete', `/todos/${id}`), [['todos'], ['goals']]);

  const countByStatus = (status: StatusTab) => todos.filter((t) => t.status === status).length;
  const filteredTodos = todos.filter((t) => t.status === activeTab);

  const openCreate = () => {
    setEditingTodo(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (todo: Todo) => {
    setEditingTodo(todo);
    setForm({
      title: todo.title,
      description: todo.description ?? '',
      priority: todo.priority,
      dueDate: todo.dueDate ? todo.dueDate.slice(0, 10) : '',
      goalId: todo.goalId ?? '',
      domainId: todo.domainId ?? '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        goalId: form.goalId || undefined,
        domainId: form.domainId || undefined,
        status: editingTodo ? editingTodo.status : 'inbox',
      };
      if (editingTodo) {
        await updateTodo.mutateAsync({ id: editingTodo.id, data: payload });
      } else {
        await createTodo.mutateAsync(payload);
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditingTodo(null);
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDone = async (todo: Todo) => {
    const isDone = todo.status === 'done';
    const payload = isDone
      ? { status: 'todo' }
      : { status: 'done', completedAt: new Date().toISOString() };
    try {
      await updateTodo.mutateAsync({ id: todo.id, data: payload });
    } catch {}
  };

  const handleDelete = async (id: string) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete);
    try {
      await deleteTodo.mutateAsync(confirmDelete);
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const isOverdue = (dateStr?: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const goalName = (goalId?: string | null) => {
    if (!goalId) return null;
    return goals.find((g) => g.id === goalId)?.title;
  };

  if (todosQuery.isLoading || goalsQuery.isLoading || domainsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-3xl mb-1"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}
          >
            待办事项
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>管理你的任务和行动</p>
        </div>
        <button
          onClick={openCreate}
          className="btn btn-primary"
        >
          <Plus size={16} />
          添加任务
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={
              activeTab === tab.key
                ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)', boxShadow: 'var(--shadow-sm)' }
                : { color: 'var(--color-text-tertiary)' }
            }
          >
            {tab.label}
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: activeTab === tab.key ? 'var(--color-bg-tertiary)' : 'transparent',
                color: activeTab === tab.key ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)'
              }}
            >
              {countByStatus(tab.key)}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filteredTodos.length === 0 && (
          <EmptyState
            icon={<Circle size={32} strokeWidth={1} />}
            title="No items"
          />
        )}

        {filteredTodos.map((todo) => {
          const done = todo.status === 'done';
          const overdue = !done && isOverdue(todo.dueDate);
          const gName = goalName(todo.goalId);
          const priority = PRIORITY_CONFIG[todo.priority];

          return (
            <div
              key={todo.id}
              className="card p-4 group flex items-start gap-4"
              style={done ? { opacity: 0.6 } : {}}
            >
              <button onClick={() => toggleDone(todo)} className="mt-0.5 flex-shrink-0">
                {done ? (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-success)' }}
                  >
                    <Check size={12} className="text-white" />
                  </div>
                ) : (
                  <div
                    className="w-5 h-5 rounded-full"
                    style={{ border: '1.5px solid var(--color-border)' }}
                  />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium flex items-center gap-1.5"
                  style={{ color: done ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)' }}
                >
                  {todo.title}
                  {isMockItem(todo) && (
                    <MockBadge
                      onClick={async () => {
                        await updateTodo.mutateAsync({ id: todo.id, data: { mock: false } });
                      }}
                    />
                  )}
                </p>
                {todo.description && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                    {todo.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{ backgroundColor: priority.bg, color: priority.color }}
                  >
                    <Flag size={10} />
                    {priority.label}
                  </span>
                  {todo.dueDate && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: overdue ? '#FEE2E2' : 'var(--color-bg-secondary)',
                        color: overdue ? '#DC2626' : 'var(--color-text-tertiary)'
                      }}
                    >
                      <Clock size={10} />
                      {overdue ? '逾期' : new Date(todo.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {gName && (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}
                    >
                      {gName}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(todo)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(todo.id)}
                  disabled={deleting === todo.id}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: '#C4453A' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="删除待办"
        message="确定删除这个待办？此操作不可撤销。"
        variant="danger"
        loading={!!deleting}
      />

      {showModal && (
        <Modal
          open={showModal}
          onClose={() => { setShowModal(false); setEditingTodo(null); setForm(emptyForm); }}
          title={editingTodo ? '编辑任务' : '新建任务'}
          maxWidth="max-w-lg"
        >
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                标题
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                placeholder="What needs to be done?"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                描述
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="input resize-none"
                placeholder="Add details..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                  优先级
                </label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as TodoFormData['priority'] })}
                  className="input"
                >
                  <option value="urgent">紧急</option>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                  截止日期
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                  目标
                </label>
                <select value={form.goalId} onChange={(e) => setForm({ ...form, goalId: e.target.value })} className="input">
                  <option value="">无</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                  领域
                </label>
                <select value={form.domainId} onChange={(e) => setForm({ ...form, domainId: e.target.value })} className="input">
                  <option value="">无</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: '1px solid var(--color-border-light)' }}>
            <button onClick={() => setShowModal(false)} className="btn btn-ghost">取消</button>
            <button onClick={handleSubmit} disabled={submitting || !form.title.trim()} className="btn btn-primary">
              {editingTodo ? '保存' : '创建'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}