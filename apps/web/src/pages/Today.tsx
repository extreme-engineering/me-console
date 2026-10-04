import { useState } from 'react';
import { format, startOfDay, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Check,
  Plus,
  Zap,
  Target,
  ArrowRight,
  Sunrise,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Goal, Habit, Reflection, Topic, Todo, Vision } from '@meos/shared';
import { apiRequest, useApiMutation, useApiQuery } from '../lib/api-queries';
import LoadingSpinner from '../components/LoadingSpinner';
import MockBadge from '../components/MockBadge';
import OnboardingBanner from '../components/onboarding/OnboardingBanner';
import { isMockItem } from '../lib/mockFlag';
import { toast } from '../stores/toastStore';

interface TodosResponse { todos: Todo[] }
interface HabitsResponse { habits: Habit[] }
interface GoalsResponse { goals: Goal[] }
interface TopicsResponse { topics: Topic[] }
interface ReflectionsResponse { reflections: Reflection[] }
interface VisionsResponse { vision: Vision | null }

const PRIORITY_DOT: Record<string, string> = {
  urgent: '#DC2626',
  high: '#EA580C',
  medium: '#64748B',
  low: '#9CA3AF',
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return { text: '夜深了', icon: Moon, sub: '注意休息' };
  if (hour < 9) return { text: '早上好', icon: Sunrise, sub: '新的一天，从最重要的事开始' };
  if (hour < 12) return { text: '上午好', icon: Sun, sub: '保持专注，高效产出' };
  if (hour < 14) return { text: '中午好', icon: Sun, sub: '适当休息，补充能量' };
  if (hour < 18) return { text: '下午好', icon: Sun, sub: '收尾今日，规划明日' };
  return { text: '晚上好', icon: Sunset, sub: '回顾今天，放松身心' };
}

export default function Today() {
  const todosQuery = useApiQuery<TodosResponse>(['todos'], '/todos');
  const habitsQuery = useApiQuery<HabitsResponse>(['habits'], '/habits');
  const goalsQuery = useApiQuery<GoalsResponse>(['goals'], '/goals');
  const topicsQuery = useApiQuery<TopicsResponse>(['topics'], '/topics');
  const reflectionsQuery = useApiQuery<ReflectionsResponse>(['reflections'], '/reflections');
  const visionsQuery = useApiQuery<VisionsResponse>(['visions'], '/visions');

  const [newTodo, setNewTodo] = useState('');
  const [addingTodo, setAddingTodo] = useState(false);
  const [togglingHabit, setTogglingHabit] = useState<string | null>(null);
  const [togglingTodo, setTogglingTodo] = useState<string | null>(null);

  const todos = todosQuery.data?.todos ?? [];
  const habits = habitsQuery.data?.habits ?? [];
  const goals = goalsQuery.data?.goals ?? [];
  const topics = topicsQuery.data?.topics ?? [];
  const reflections = reflectionsQuery.data?.reflections ?? [];
  const vision = visionsQuery.data?.vision || null;

  const createTodo = useApiMutation((data: Record<string, unknown>) => apiRequest('post', '/todos', data), [['todos']]);
  const updateTodo = useApiMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/todos/${id}`, data),
    [['todos'], ['goals']]
  );
  const logHabit = useApiMutation(
    ({ habitId, date }: { habitId: string; date: string }) => apiRequest('post', `/habits/${habitId}/log`, { date }),
    [['habits'], ['goals']]
  );
  const updateHabit = useApiMutation(
    ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest('patch', `/habits/${id}`, data),
    [['habits']]
  );

  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const pendingTodos = todos
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return pOrder[a.priority] - pOrder[b.priority];
    });

  const doneTodayCount = todos.filter((t) => t.status === 'done').length;
  const activeGoals = goals.filter((g) => g.status === 'active');
  const activeTopics = topics.filter((t) => t.status !== 'archived');
  const todayReflection = reflections.find((r) =>
    r.date && r.date.startsWith(todayStr)
  );

  const handleAddTodo = async () => {
    const title = newTodo.trim();
    if (!title) return;
    setAddingTodo(true);
    try {
      await createTodo.mutateAsync({ title, status: 'todo', priority: 'medium' });
      setNewTodo('');
    } finally {
      setAddingTodo(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    setTogglingTodo(todo.id);
    try {
      const isDone = todo.status === 'done';
      const payload = isDone
        ? { status: 'todo' }
        : { status: 'done', completedAt: new Date().toISOString() };
      await updateTodo.mutateAsync({ id: todo.id, data: payload });
    } finally {
      setTogglingTodo(null);
    }
  };

  const toggleHabit = async (habit: Habit) => {
    setTogglingHabit(habit.id);
    try {
      await logHabit.mutateAsync({ habitId: habit.id, date: todayStr });
    } catch {
      toast.error('操作失败，请重试');
    } finally {
      setTogglingHabit(null);
    }
  };

  const goalName = (goalId?: string | null) => {
    if (!goalId) return null;
    return goals.find((g) => g.id === goalId)?.title;
  };

  // 认领演示数据：写 mock:false 去除徽标（仅本地演示模式存在 mock 记录）
  const claimTodo = async (todo: Todo) => {
    try {
      await updateTodo.mutateAsync({ id: todo.id, data: { mock: false } });
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  const claimHabit = async (habit: Habit) => {
    try {
      await updateHabit.mutateAsync({ id: habit.id, data: { mock: false } });
    } catch {
      toast.error('操作失败，请重试');
    }
  };

  if (todosQuery.isLoading || habitsQuery.isLoading || goalsQuery.isLoading || topicsQuery.isLoading || reflectionsQuery.isLoading || visionsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-enter">
      {/* Onboarding Wizard Banner */}
      <OnboardingBanner />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1.5">
          <GreetingIcon size={24} style={{ color: 'var(--color-accent)' }} />
          <h1
            className="text-3xl"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--color-ink)',
            }}
          >
            {greeting.text}
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-ink-2)' }}>
          {greeting.sub} · {format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhCN })}
        </p>
      </div>

      {/* Vision Banner */}
      {vision && (
        <div
          className="rounded-xl p-5 mb-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #6B6965 0%, #55524D 100%)',
            color: 'var(--color-ink-inverse)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-[2px]" style={{ backgroundColor: 'rgba(255, 255, 255, 0.65)' }} />
            <p className="text-xs font-medium tracking-widest" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-paper-3)' }}>
              我的愿景
            </p>
          </div>
          <p className="text-[15px] leading-relaxed max-w-3xl">
            {vision.content}
          </p>
        </div>
      )}

      {/* Stat Band */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-8">
        <Link to="/direction?tab=goals" className="card p-4">
          <p className="text-label mb-1.5">活跃目标</p>
          <p className="text-2xl text-num" style={{ color: 'var(--color-ink)' }}>
            {activeGoals.length}
          </p>
        </Link>
        <Link to="/action/todos" className="card p-4">
          <p className="text-label mb-1.5">待办</p>
          <p className="text-2xl text-num" style={{ color: 'var(--color-ink)' }}>
            {pendingTodos.length}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-3)' }}>
            {doneTodayCount} 项已完成
          </p>
        </Link>
        <Link to="/action/habits" className="card p-4">
          <p className="text-label mb-1.5">今日打卡</p>
          <p className="text-2xl text-num" style={{ color: 'var(--color-ink)' }}>
            {habits.filter((h) => h.logs?.some((l) => isSameDay(startOfDay(new Date(l.date)), today))).length}
            <span className="text-base" style={{ color: 'var(--color-ink-3)' }}> / {habits.length}</span>
          </p>
        </Link>
        <Link to="/cognition?tab=topics" className="card p-4">
          <p className="text-label mb-1.5">活跃课题</p>
          <p className="text-2xl text-num" style={{ color: 'var(--color-ink)' }}>
            {activeTopics.length}
          </p>
        </Link>
        <Link to="/reflection?tab=daily" className="card p-4">
          <p className="text-label mb-1.5">今日反思</p>
          <p
            className="text-2xl text-num"
            style={{ color: todayReflection ? 'var(--color-ink)' : 'var(--color-accent)' }}
          >
            {todayReflection ? '✓ 已写' : '待写'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-3)' }}>
            {todayReflection ? '记录收获与明日计划' : '花三分钟记录今天'}
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Todos Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--color-ink)' }}>
              今日待办
            </h2>
            <Link
              to="/action/todos"
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              全部待办 <ArrowRight size={12} />
            </Link>
          </div>

          {/* Quick Add */}
          <div className="card p-3 mb-3 flex items-center gap-2">
            <Plus size={16} style={{ color: 'var(--color-text-tertiary)' }} />
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(); }}
              placeholder="快速添加待办..."
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
            {newTodo.trim() && (
              <button
                onClick={handleAddTodo}
                disabled={addingTodo}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ backgroundColor: 'var(--color-ink-soft)', color: 'var(--color-text-inverse)' }}
              >
                {addingTodo ? '...' : '添加'}
              </button>
            )}
          </div>

          {/* Todo List */}
          <div className="space-y-2">
            {pendingTodos.length === 0 ? (
              <div className="card p-6 text-center">
                <Target size={24} className="mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  暂无待办事项，享受当下吧
                </p>
              </div>
            ) : (
              pendingTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="card p-3 flex items-center gap-3 group"
                >
                  <button
                    onClick={() => toggleTodo(todo)}
                    disabled={togglingTodo === todo.id}
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
                    style={{
                      border: '1.5px solid var(--color-border)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                  >
                    {togglingTodo === todo.id ? (
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-text-tertiary)' }} />
                    ) : (
                      <Check size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-text-primary)' }} />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {todo.title}
                    </p>
                    {goalName(todo.goalId) && (
                      <p className="text-xs truncate" style={{ color: 'var(--color-ink-3)' }}>
                        {goalName(todo.goalId)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isMockItem(todo) && <MockBadge onClick={() => claimTodo(todo)} />}
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PRIORITY_DOT[todo.priority] || '#9CA3AF' }}
                    />
                    {todo.dueDate && (
                      <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                        {new Date(todo.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Habits Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--color-ink)' }}>
              习惯打卡
            </h2>
            <Link
              to="/action/habits"
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              全部习惯 <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-2">
            {habits.length === 0 ? (
              <div className="card p-6 text-center">
                <Zap size={24} className="mx-auto mb-2" style={{ color: 'var(--color-text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  暂无习惯，去创建第一个吧
                </p>
              </div>
            ) : (
              habits.map((habit) => {
                const isTodayLogged = habit.logs?.some((l) =>
                  isSameDay(startOfDay(new Date(l.date)), today)
                );
                return (
                  <div
                    key={habit.id}
                    className="card p-3 flex items-center gap-3"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: habit.color || 'var(--color-text-tertiary)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                        {habit.title}
                        {isMockItem(habit) && <MockBadge onClick={() => claimHabit(habit)} />}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-ink-3)' }}>
                        {habit.frequency === 'daily' ? '每日' : '每周'}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleHabit(habit)}
                      disabled={togglingHabit === habit.id}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                      style={
                        isTodayLogged
                          ? { backgroundColor: 'var(--color-success-soft)', color: 'var(--color-success)' }
                          : { backgroundColor: 'var(--color-paper-2)', color: 'var(--color-ink-2)' }
                      }
                    >
                      {togglingHabit === habit.id ? (
                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: 'currentColor' }} />
                      ) : (
                        <Check size={14} />
                      )}
                      {isTodayLogged ? '已完成' : '打卡'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
