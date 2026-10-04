import type { Domain, Goal } from '@meos/shared';
import MockBadge from '../../../components/MockBadge';
import { isMockItem } from '../../../lib/mockFlag';
import { getProgress } from './useGoals';

const boardColumns: { key: Goal['status']; label: string; color: string }[] = [
  { key: 'active', label: '进行中', color: '#10B981' },
  { key: 'planned', label: '计划中', color: '#3B82F6' },
  { key: 'completed', label: '已完成', color: '#64748B' },
  { key: 'abandoned', label: '已归档', color: '#9CA3AF' },
];

interface GoalBoardProps {
  goals: Goal[];
  domainMap: Record<string, Domain>;
  onEdit: (goal: Goal) => void;
  onClearMock: (goalId: string) => void;
}

export default function GoalBoard({ goals, domainMap, onEdit, onClearMock }: GoalBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {boardColumns.map((col) => {
        const colGoals = goals.filter((g) => g.status === col.key);
        return (
          <div key={col.key} className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{col.label}</span>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{colGoals.length}</span>
            </div>
            <div className="space-y-3">
              {colGoals.map((goal) => {
                const progress = getProgress(goal);
                const domain = domainMap[goal.domainId];
                return (
                  <div
                    key={goal.id}
                    className="card p-4 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => onEdit(goal)}
                  >
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                      {goal.title}
                      {isMockItem(goal) && <MockBadge onClick={() => onClearMock(goal.id)} />}
                    </h3>
                    {domain && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 mb-2">
                        {domain.name}
                      </span>
                    )}
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${progress}%`, backgroundColor: col.color }}
                          />
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                          {progress}%
                        </span>
                      </div>
                    </div>
                    {goal.keyResults && goal.keyResults.length > 0 && (
                      <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-tertiary)' }}>
                        {goal.keyResults.length} 个关键结果
                      </p>
                    )}
                  </div>
                );
              })}
              {colGoals.length === 0 && (
                <div className="card p-4 text-center border-dashed" style={{ borderStyle: 'dashed', color: 'var(--color-text-tertiary)' }}>
                  <p className="text-xs">暂无项目</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
