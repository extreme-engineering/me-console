import { useState } from 'react';
import type { Domain, Goal, KeyResult } from '@meos/shared';
import { Target, ChevronDown, ChevronRight, Edit2, Trash2, Plus } from 'lucide-react';
import MockBadge from '../../../components/MockBadge';
import { isMockItem } from '../../../lib/mockFlag';
import { formatDate } from './useGoals';

const statusTabs = ['all', 'active', 'planned', 'completed', 'abandoned'] as const;
type StatusTab = typeof statusTabs[number];

const statusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  planned: 'bg-blue-50 text-blue-700',
  completed: 'bg-slate-100 text-slate-500',
  abandoned: 'bg-red-50 text-red-600',
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-slate-50 text-slate-600',
  low: 'bg-gray-50 text-gray-500',
};

const defaultKRForm = {
  title: '',
  targetValue: '',
  unit: '',
  order: '0',
};

interface GoalListProps {
  goals: Goal[];
  domainMap: Record<string, Domain>;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onClearMock: (goalId: string) => void;
  onAddKR: (goalId: string, data: { title: string; targetValue: number; unit: string; order: number }) => void;
  onSaveKR: (kr: KeyResult, currentValue: number) => void;
  onDeleteKR: (goalId: string, krId: string) => void;
  onCreateFirst: () => void;
  getProgress: (goal: Goal) => number;
}

export default function GoalList({
  goals,
  domainMap,
  expandedId,
  onToggleExpand,
  onEdit,
  onDelete,
  onClearMock,
  onAddKR,
  onSaveKR,
  onDeleteKR,
  onCreateFirst,
  getProgress,
}: GoalListProps) {
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [showKRForm, setShowKRForm] = useState<string | null>(null);
  const [krForm, setKrForm] = useState(defaultKRForm);
  const [editingKR, setEditingKR] = useState<string | null>(null);
  const [editKRValue, setEditKRValue] = useState('');

  const filteredGoals = activeTab === 'all' ? goals : goals.filter((g) => g.status === activeTab);

  const handleStartEditKR = (kr: KeyResult) => {
    setEditingKR(kr.id);
    setEditKRValue(String(kr.currentValue));
  };

  const handleSaveKR = (kr: KeyResult) => {
    onSaveKR(kr, parseFloat(editKRValue) || 0);
    setEditingKR(null);
    setEditKRValue('');
  };

  const handleDeleteKR = (goalId: string, krId: string) => {
    if (!window.confirm('确定删除这个关键结果？')) return;
    onDeleteKR(goalId, krId);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-6">
        {statusTabs.map((tab) => {
          const count = tab === 'all' ? goals.length : goals.filter((g) => g.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-[var(--color-ink-soft)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-text-tertiary)]'
              }`}
            >
              {tab}
              {count > 0 && <span className="ml-1.5 opacity-50">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filteredGoals.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-xl border border-dashed border-slate-200 p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-50 flex items-center justify-center">
              <Target className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 mb-1">
              {activeTab === 'all' ? 'No goals yet' : `No ${activeTab} goals`}
            </p>
            <button
              onClick={onCreateFirst}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Create your first goal
            </button>
          </div>
        ) : (
          filteredGoals.map((goal) => {
            const progress = getProgress(goal);
            const isExpanded = expandedId === goal.id;
            const domain = domainMap[goal.domainId];

            return (
              <div
                key={goal.id}
                className="group bg-[var(--color-surface)] rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <button
                          onClick={() => onToggleExpand(goal.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <h3 className="text-base font-medium text-slate-900 truncate">
                          {goal.title}
                          {isMockItem(goal) && <MockBadge onClick={() => onClearMock(goal.id)} />}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 ml-7 flex-wrap">
                        {domain && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700">
                            {domain.name}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${priorityColors[goal.priority]}`}>
                          {goal.priority}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[goal.status]}`}>
                          {goal.status}
                        </span>
                        {goal.endDate && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            Due {formatDate(goal.endDate)}
                          </span>
                        )}
                      </div>

                      {goal.keyResults && goal.keyResults.length > 0 && (
                        <div className="ml-7 mt-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--color-ink-soft)] rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-medium text-slate-500 w-8 text-right">
                              {progress}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => onEdit(goal)}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(goal.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-50 px-5 pb-5 pt-3 ml-7">
                    {goal.keyResults && goal.keyResults.length > 0 ? (
                      <div className="space-y-3">
                        {goal.keyResults.map((kr) => {
                          const krProgress = kr.targetValue > 0
                            ? Math.round((kr.currentValue / kr.targetValue) * 100)
                            : 0;

                          return (
                            <div
                              key={kr.id}
                              className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-lg"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm text-slate-700 truncate">{kr.title}</p>
                                  <button
                                    onClick={() => handleDeleteKR(goal.id, kr.id)}
                                    className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-slate-600 rounded-full transition-all duration-300"
                                      style={{ width: `${Math.min(krProgress, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-500 shrink-0">
                                    {editingKR === kr.id ? (
                                      <span className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          value={editKRValue}
                                          onChange={(e) => setEditKRValue(e.target.value)}
                                          className="w-16 px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs text-right"
                                          step="any"
                                        />
                                        <button
                                          onClick={() => handleSaveKR(kr)}
                                          className="px-2 py-1 bg-[var(--color-ink-soft)] text-white text-[10px] rounded hover:bg-slate-800"
                                        >
                                          Save
                                        </button>
                                      </span>
                                    ) : (
                                      <span
                                        onClick={() => handleStartEditKR(kr)}
                                        className="cursor-pointer hover:text-slate-700 transition-colors"
                                      >
                                        {kr.currentValue}/{kr.targetValue} {kr.unit}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mb-2">No key results yet</p>
                    )}

                    {showKRForm === goal.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          onAddKR(goal.id, {
                            title: krForm.title,
                            targetValue: parseFloat(krForm.targetValue) || 0,
                            unit: krForm.unit,
                            order: parseInt(krForm.order) || 0,
                          });
                          setShowKRForm(null);
                          setKrForm(defaultKRForm);
                        }}
                        className="mt-3 p-3 bg-slate-50/50 rounded-lg space-y-2"
                      >
                        <input
                          type="text"
                          placeholder="Key result title"
                          value={krForm.title}
                          onChange={(e) => setKrForm({ ...krForm, title: e.target.value })}
                          required
                          className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-300"
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Target"
                            value={krForm.targetValue}
                            onChange={(e) => setKrForm({ ...krForm, targetValue: e.target.value })}
                            required
                            className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-300"
                            step="any"
                          />
                          <input
                            type="text"
                            placeholder="Unit"
                            value={krForm.unit}
                            onChange={(e) => setKrForm({ ...krForm, unit: e.target.value })}
                            className="w-24 px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-300"
                          />
                          <input
                            type="number"
                            placeholder="Order"
                            value={krForm.order}
                            onChange={(e) => setKrForm({ ...krForm, order: e.target.value })}
                            className="w-20 px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-300"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-[var(--color-ink-soft)] hover:bg-[var(--color-ink-soft-hover)] text-white text-sm font-medium rounded-lg transition-all"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowKRForm(null)}
                            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          setShowKRForm(goal.id);
                          setKrForm(defaultKRForm);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add Key Result
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
