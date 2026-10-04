import { useState } from 'react';
import type { Domain, Goal } from '@meos/shared';
import Modal from '../../../components/Modal';

interface GoalForm {
  title: string;
  domainId: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'planned' | 'active' | 'completed' | 'abandoned';
  startDate: string;
  endDate: string;
}

const defaultForm: GoalForm = {
  title: '',
  domainId: '',
  description: '',
  priority: 'medium',
  status: 'planned',
  startDate: '',
  endDate: '',
};

interface GoalFormModalProps {
  editingGoal: Goal | null;
  domains: Domain[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (form: GoalForm) => void;
}

export default function GoalFormModal({ editingGoal, domains, submitting, onClose, onSubmit }: GoalFormModalProps) {
  const [form, setForm] = useState<GoalForm>(
    editingGoal
      ? {
          title: editingGoal.title,
          domainId: editingGoal.domainId,
          description: editingGoal.description || '',
          priority: editingGoal.priority,
          status: editingGoal.status,
          startDate: editingGoal.startDate ? editingGoal.startDate.split('T')[0] : '',
          endDate: editingGoal.endDate ? editingGoal.endDate.split('T')[0] : '',
        }
      : defaultForm
  );

  const handleSubmitGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.domainId) return;
    onSubmit(form);
  };

  return (
    <Modal open onClose={onClose} title={editingGoal ? '编辑目标' : '新建目标'} maxWidth="max-w-lg">
      <form onSubmit={handleSubmitGoal}>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
              标题
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="input"
              placeholder="目标标题"
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
              领域
            </label>
            <select
              value={form.domainId}
              onChange={(e) => setForm({ ...form, domainId: e.target.value })}
              className="input"
            >
              <option value="">选择领域</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
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
              placeholder="描述你的目标"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                优先级
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as GoalForm['priority'] })}
                className="input"
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                状态
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as GoalForm['status'] })}
                className="input"
              >
                <option value="planned">计划中</option>
                <option value="active">进行中</option>
                <option value="completed">已完成</option>
                <option value="abandoned">已放弃</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                开始日期
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>
                结束日期
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn btn-ghost">
              取消
            </button>
            <button type="submit" disabled={submitting} className="flex-1 btn btn-primary">
              {submitting ? '保存中...' : editingGoal ? '更新' : '创建'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
