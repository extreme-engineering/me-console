import { useState } from 'react';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { Plus, Check, Flame, TrendingUp } from 'lucide-react';
import type { Goal, Habit as SharedHabit, HabitLog } from '@meos/shared';
import { apiRequest, useApiMutation, useApiQuery } from '../../lib/api-queries';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import HealthTrackerView from '../../components/HealthTrackerView';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import MockBadge from '../../components/MockBadge';
import { isMockItem } from '../../lib/mockFlag';

// goalTitle 由 /habits 联表返回，shared 类型暂未包含，页面本地补充
type Habit = SharedHabit & { goalTitle?: string };

interface HabitsResponse { habits: Habit[] }
interface GoalsResponse { goals: Goal[] }

const COLOR_PRESETS = [
  { name: 'slate', hex: '#64748B' },
  { name: 'emerald', hex: '#10B981' },
  { name: 'blue', hex: '#3B82F6' },
  { name: 'violet', hex: '#8B5CF6' },
  { name: 'amber', hex: '#F59E0B' },
  { name: 'rose', hex: '#F43F5E' },
];



function getStreak(logs?: HabitLog[]): number {
  if (!logs?.length) return 0;
  const logDates = logs.map((l) => startOfDay(new Date(l.date))).sort((a, b) => b.getTime() - a.getTime());
  const uniqueDays = Array.from(new Set(logDates.map((d) => d.getTime()))).sort((a, b) => b - a);
  if (!uniqueDays.length) return 0;
  let streak = 0;
  let current = startOfDay(new Date());
  const todayLogged = uniqueDays.some((d) => isSameDay(new Date(d), current));
  if (!todayLogged) current = subDays(current, 1);
  for (let i = 0; i < 365; i++) {
    if (uniqueDays.includes(current.getTime())) { streak++; current = subDays(current, 1); }
    else break;
  }
  return streak;
}

function getLast7Days(today: Date) { return Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i)); }
function getLast30Days(today: Date) { return Array.from({ length: 30 }, (_, i) => subDays(today, 29 - i)); }

const defaultForm = {
  title: '',
  description: '',
  frequency: 'daily' as 'daily' | 'weekly',
  targetPerWeek: 3,
  color: '#3B82F6',
  goalId: '',
};

export default function Habits() {
  const today = startOfDay(new Date());
  const habitsQuery = useApiQuery<HabitsResponse>(['habits'], '/habits');
  const goalsQuery = useApiQuery<GoalsResponse>(['goals'], '/goals');

  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [detailHabit, setDetailHabit] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'habits' | 'health'>('habits');

  const habits = habitsQuery.data?.habits ?? [];
  const goals = goalsQuery.data?.goals ?? [];

  const createHabit = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/habits', data), [['habits'], ['goals']]);
  const updateHabit = useApiMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/habits/${id}`, data),
    [['habits'], ['goals']]
  );
  const deleteHabit = useApiMutation((id: string) => apiRequest('delete', `/habits/${id}`), [['habits'], ['goals']]);
  const logHabit = useApiMutation(
    ({ habitId, date }: { habitId: string; date: string }) => apiRequest('post', `/habits/${habitId}/log`, { date }),
    [['habits'], ['goals']]
  );

  const openAdd = () => { setEditingHabit(null); setForm(defaultForm); setShowModal(true); };

  const openEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setForm({
      title: habit.title,
      description: habit.description || '',
      frequency: habit.frequency,
      targetPerWeek: habit.targetPerWeek || 3,
      color: habit.color || '#3B82F6',
      goalId: habit.goalId || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        frequency: form.frequency,
        targetPerWeek: form.frequency === 'weekly' ? form.targetPerWeek : undefined,
        color: form.color,
        goalId: form.goalId || undefined,
      };
      if (editingHabit) await updateHabit.mutateAsync({ id: editingHabit.id, data: payload });
      else await createHabit.mutateAsync(payload);
      setShowModal(false);
    } finally { setSaving(false); }
  };

  const toggleLog = async (habit: Habit) => {
    const todayStr = format(today, 'yyyy-MM-dd');
    try {
      await logHabit.mutateAsync({ habitId: habit.id, date: todayStr });
    } catch {}
  };

  const handleDelete = async (id: string) => {
    setConfirmDelete(id);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete);
    try {
      await deleteHabit.mutateAsync(confirmDelete);
    } finally { setDeleting(null); setConfirmDelete(null); }
  };

  if (habitsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-3xl mb-1"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}
          >
            习惯追踪
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>建立好习惯，追踪健康数据</p>
        </div>
        {activeTab === 'habits' && (
          <button onClick={openAdd} className="btn btn-primary">
            <Plus size={16} />
            添加习惯
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <button
          onClick={() => setActiveTab('habits')}
          className={`px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'habits' ? 'font-medium' : ''}`}
          style={{
            backgroundColor: activeTab === 'habits' ? 'var(--color-surface)' : 'transparent',
            color: activeTab === 'habits' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            boxShadow: activeTab === 'habits' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          习惯打卡
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-2 text-sm rounded-lg transition-all ${activeTab === 'health' ? 'font-medium' : ''}`}
          style={{
            backgroundColor: activeTab === 'health' ? 'var(--color-surface)' : 'transparent',
            color: activeTab === 'health' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            boxShadow: activeTab === 'health' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          健康数据
        </button>
      </div>

      {activeTab === 'health' ? (
        <HealthTrackerView />
      ) : (
      <>
      {/* Habits List */}
      <div className="space-y-3">
        {habits.length === 0 && (
          <EmptyState
            icon={<TrendingUp size={32} strokeWidth={1} />}
            title="No habits yet"
            description="Create your first one to start tracking."
          />
        )}

        {habits.map((habit) => {
          const isExpanded = detailHabit === habit.id;
          const streak = getStreak(habit.logs);
          const isTodayLogged = habit.logs?.some((l) => isSameDay(startOfDay(new Date(l.date)), today));
    const last7Days = getLast7Days(today);
    const last30Days = getLast30Days(today);
          const logDates = new Set(habit.logs?.map((l) => format(startOfDay(new Date(l.date)), 'yyyy-MM-dd')) || []);

          return (
            <div key={habit.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full mt-2 shrink-0"
                    style={{ backgroundColor: habit.color || 'var(--color-text-tertiary)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{habit.title}</h3>
                      {isMockItem(habit) && (
                        <MockBadge
                          onClick={async () => {
                            await updateHabit.mutateAsync({ id: habit.id, data: { mock: false } });
                          }}
                        />
                      )}
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}
                      >
                        {habit.frequency === 'daily' ? '每日' : '每周'}
                      </span>
                    </div>
                    {habit.description && (
                      <p className="text-xs mb-3" style={{ color: 'var(--color-text-tertiary)' }}>{habit.description}</p>
                    )}

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleLog(habit)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        style={
                          isTodayLogged
                            ? { backgroundColor: '#DCFCE7', color: '#16A34A' }
                            : { backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }
                        }
                      >
                        <Check size={14} />
                        {isTodayLogged ? '已完成' : '标记完成'}
                      </button>

                      <div className="flex items-center gap-1">
                        {last7Days.map((day) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const filled = logDates.has(dateStr);
                          return (
                            <div
                              key={dateStr}
                              className="w-4 h-4 rounded-full"
                              style={{
                                backgroundColor: filled ? (habit.color ?? undefined) : 'var(--color-bg-tertiary)',
                                border: filled ? 'none' : '1.5px solid var(--color-border)',
                              }}
                              title={format(day, 'MMM d')}
                            />
                          );
                        })}
                      </div>

                      {streak > 0 && (
                        <div className="flex items-center gap-1 text-xs font-medium" style={{ color: '#F59E0B' }}>
                          <Flame size={14} />
                          {streak}天
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailHabit(isExpanded ? null : habit.id)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-text-tertiary)', backgroundColor: 'var(--color-bg-secondary)' }}
                  >
                    {isExpanded ? '收起' : '详情'}
                  </button>
                  <button
                    onClick={() => openEdit(habit)}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(habit.id)}
                    disabled={deleting === habit.id}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: '#C4453A' }}
                  >
                    删除
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-tertiary)' }}>最近30天</p>
                  <div className="flex flex-wrap gap-1.5">
                    {last30Days.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const filled = logDates.has(dateStr);
                      return (
                        <div
                          key={dateStr}
                          className="w-5 h-5 rounded-sm"
                          style={{
                            backgroundColor: filled ? (habit.color ?? undefined) : 'var(--color-bg-secondary)',
                            opacity: filled ? 0.8 : 1,
                          }}
                          title={format(day, 'MMM d, yyyy')}
                        />
                      );
                    })}
                  </div>
                  {habit.goalTitle && (
                    <p className="text-xs mt-3" style={{ color: 'var(--color-text-tertiary)' }}>
                      关联目标: <span style={{ color: 'var(--color-text-secondary)' }}>{habit.goalTitle}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="删除习惯"
        message="确定删除这个习惯？此操作不可撤销。"
        variant="danger"
        loading={!!deleting}
      />

      {showModal && (
        <Modal open={showModal} onClose={() => setShowModal(false)} title={editingHabit ? '编辑习惯' : '新建习惯'} maxWidth="max-w-md">
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>标题</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="input"
                placeholder="e.g. 冥想"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>描述</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input resize-none"
                rows={2}
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>频率</label>
                <select
                  value={form.frequency}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value as 'daily' | 'weekly' }))}
                  className="input"
                >
                  <option value="daily">每日</option>
                  <option value="weekly">每周</option>
                </select>
              </div>
              {form.frequency === 'weekly' && (
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>目标/周</label>
                  <input
                    type="number" min={1} max={7}
                    value={form.targetPerWeek}
                    onChange={(e) => setForm((f) => ({ ...f, targetPerWeek: Number(e.target.value) }))}
                    className="input"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>颜色</label>
              <div className="flex gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setForm((f) => ({ ...f, color: c.hex }))}
                    className="w-8 h-8 rounded-full transition-transform"
                    style={{
                      backgroundColor: c.hex,
                      transform: form.color === c.hex ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: form.color === c.hex ? `0 0 0 2px white, 0 0 0 4px ${c.hex}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>关联目标</label>
              <select value={form.goalId} onChange={(e) => setForm((f) => ({ ...f, goalId: e.target.value }))} className="input">
                <option value="">无</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="btn btn-primary w-full"
            >
              {saving ? '保存中...' : editingHabit ? '更新习惯' : '创建习惯'}
            </button>
          </div>
        </Modal>
      )}
      </>
      )}
    </div>
  );
}