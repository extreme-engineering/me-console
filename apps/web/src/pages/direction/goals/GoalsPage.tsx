import { useMemo, useState } from 'react';
import type { Domain, Goal } from '@meos/shared';
import { LayoutList, LayoutGrid, Plus } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ConfirmDialog from '../../../components/ConfirmDialog';
import {
  useAddKeyResult,
  useCreateGoal,
  useDeleteGoal,
  useDeleteKeyResult,
  useDomainsQuery,
  useGoalsQuery,
  useUpdateGoal,
  useUpdateKeyResult,
  getProgress,
} from './useGoals';
import GoalList from './GoalList';
import GoalBoard from './GoalBoard';
import GoalFormModal from './GoalFormModal';
import OkrSopCard from './OkrSopCard';
import { toast } from '../../../stores/toastStore';

export default function GoalsPage() {
  const goalsQuery = useGoalsQuery();
  const domainsQuery = useDomainsQuery();

  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const addKR = useAddKeyResult();
  const updateKR = useUpdateKeyResult();
  const deleteKR = useDeleteKeyResult();

  const goals = goalsQuery.data?.goals ?? [];
  const domains = useMemo(() => domainsQuery.data?.domains ?? [], [domainsQuery.data]);

  const domainMap = useMemo(
    () =>
      domains.reduce<Record<string, Domain>>((acc, d) => {
        acc[d.id] = d;
        return acc;
      }, {}),
    [domains]
  );

  if (goalsQuery.isLoading || domainsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const handleOpenAdd = () => {
    setEditingGoal(null);
    setShowModal(true);
  };

  const handleOpenEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setShowModal(true);
  };

  const handleSubmitGoal = (form: {
    title: string;
    domainId: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    status: 'planned' | 'active' | 'completed' | 'abandoned';
    startDate: string;
    endDate: string;
  }) => {
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      domainId: form.domainId,
      description: form.description.trim() || undefined,
      priority: form.priority,
      status: form.status,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };
    const request = editingGoal
      ? updateGoal.mutateAsync({ id: editingGoal.id, data: payload })
      : createGoal.mutateAsync(payload);
    request
      .then(() => {
        setShowModal(false);
        setEditingGoal(null);
      })
      .catch(() => toast.error('保存失败，请重试'));
  };

  const confirmDeleteAction = () => {
    if (!confirmDelete) return;
    deleteGoal
      .mutateAsync(confirmDelete)
      .then(() => setConfirmDelete(null))
      .catch(() => toast.error('删除失败，请重试'));
  };

  return (
    <div className="page-enter">
      <div className="mb-6 flex justify-between items-end">
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
            目标与项目
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            设置目标并追踪关键结果，看板视图管理项目进度
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-[var(--color-surface)] shadow-sm' : ''}`}
              style={{ color: viewMode === 'list' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
              title="列表视图"
            >
              <LayoutList size={16} />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-2 rounded-md transition-all ${viewMode === 'board' ? 'bg-[var(--color-surface)] shadow-sm' : ''}`}
              style={{ color: viewMode === 'board' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
              title="看板视图"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <button onClick={handleOpenAdd} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            新建目标
          </button>
        </div>
      </div>

      <OkrSopCard />

      {viewMode === 'board' ? (
        <GoalBoard
          goals={goals}
          domainMap={domainMap}
          onEdit={handleOpenEdit}
          onClearMock={(goalId) => updateGoal.mutate({ id: goalId, data: { mock: false } })}
        />
      ) : (
        <GoalList
          goals={goals}
          domainMap={domainMap}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
          onEdit={handleOpenEdit}
          onDelete={(id) => setConfirmDelete(id)}
          onClearMock={(goalId) => updateGoal.mutate({ id: goalId, data: { mock: false } })}
          onAddKR={(goalId, data) => addKR.mutate({ goalId, data })}
          onSaveKR={(kr, currentValue) => updateKR.mutate({ goalId: kr.goalId, krId: kr.id, data: { currentValue } })}
          onDeleteKR={(goalId, krId) => deleteKR.mutate({ goalId, krId })}
          onCreateFirst={handleOpenAdd}
          getProgress={getProgress}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="删除目标"
        message="确定删除这个目标？此操作不可撤销。"
        variant="danger"
      />

      {showModal && (
        <GoalFormModal
          editingGoal={editingGoal}
          domains={domains}
          submitting={createGoal.isPending || updateGoal.isPending}
          onClose={() => {
            setShowModal(false);
            setEditingGoal(null);
          }}
          onSubmit={handleSubmitGoal}
        />
      )}
    </div>
  );
}
