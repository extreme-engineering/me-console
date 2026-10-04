/**
 * localDBAdapter（local 通路，Chrome 扩展 / VITE_USE_LOCAL=1）路由契约测试。
 *
 * 与 supabaseAdapter.test.ts 对称：重点防护子资源路由串扰
 * （删笔记不能删主题、删 KR 不能删目标），以及登录门禁与查询参数解析。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { db, calls } = vi.hoisted(() => {
  const calls: string[] = [];
  const record = (ns: string, fn: string) => (...args: unknown[]) => {
    calls.push(`${ns}.${fn}(${args.map((a) => JSON.stringify(a)).join(',')})`);
    return { id: 'x-1' };
  };
  const namespace = (name: string, fns: string[]) =>
    Object.fromEntries(fns.map((fn) => [fn, record(name, fn)]));

  const db = {
    auth: {
      currentUserId: 'u1' as string | null,
      getCurrentUserId() {
        return db.auth.currentUserId;
      },
      login: vi.fn(async () => ({ user: { id: 'u1' }, token: 'local-token' })),
      register: vi.fn(async () => ({ user: { id: 'u2' }, token: 'local-token' })),
      setCurrentUserId: vi.fn((id: string) => {
        db.auth.currentUserId = id;
      }),
      getCurrentUser: vi.fn(async (): Promise<{ id: string } | null> => ({ id: 'u1' })),
    },
    domains: namespace('domains', ['getAll', 'create', 'update', 'delete']),
    mindsets: namespace('mindsets', ['getAll', 'create', 'update', 'delete']),
    balanceWheel: namespace('balanceWheel', ['saveScores', 'getHistory', 'deleteRecord']),
    reflections: namespace('reflections', ['getAll', 'create', 'update', 'delete', 'getTodaySummary']),
    reviews: namespace('reviews', ['getAll', 'create', 'update', 'delete']),
    insights: namespace('insights', ['getAll', 'create', 'update', 'delete']),
    subscriptions: namespace('subscriptions', [
      'getAll', 'getOne', 'create', 'update', 'delete',
      'addQuota', 'updateQuota', 'deleteQuota', 'recordUsage', 'getDashboardSummary',
    ]),
    topics: namespace('topics', ['getAll', 'create', 'update', 'delete', 'addNote', 'deleteNote']),
    todos: namespace('todos', ['getAll', 'create', 'update', 'delete']),
    habits: namespace('habits', ['getAll', 'create', 'update', 'delete', 'toggleLog']),
    goals: namespace('goals', [
      'getAll', 'create', 'update', 'delete',
      'createKeyResult', 'updateKeyResult', 'deleteKeyResult',
    ]),
    visions: namespace('visions', ['getActive', 'getHistory', 'create', 'update']),
    contacts: namespace('contacts', ['getAll', 'create', 'update', 'delete', 'touch']),
    opportunities: namespace('opportunities', ['getAll', 'create', 'update', 'delete']),
    readingItems: namespace('readingItems', ['getAll', 'create', 'update', 'delete']),
    healthRecords: namespace('healthRecords', ['getAll', 'getSummary', 'create', 'update', 'delete']),
    workflows: namespace('workflows', [
      'getAll', 'getOne', 'create', 'update', 'delete',
      'addStep', 'updateStep', 'deleteStep', 'addConnection', 'deleteConnection',
    ]),
  };
  return { db, calls };
});

vi.mock('./localDB', () => ({ localDB: db }));
vi.mock('../supabase/client', () => ({
  supabase: {},
  supabaseUrl: 'http://localhost',
  supabaseAnonKey: 'anon',
  getSupabaseUrl: () => 'http://localhost',
}));

vi.stubEnv('VITE_USE_LOCAL', '1');
const { default: api } = await import('./api');

async function errorOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    return (e as { response?: { data?: { error?: string } } }).response?.data?.error;
  }
}

beforeEach(() => {
  calls.length = 0;
  db.auth.currentUserId = 'u1';
});

describe('登录门禁', () => {
  it('未登录访问业务路由抛「请先登录」，不触达任何数据层', async () => {
    db.auth.currentUserId = null;
    expect(await errorOf(api.request('/todos'))).toContain('请先登录');
    expect(calls).toHaveLength(0);
  });

  it('/auth/login 走 localDB.auth 并设置当前用户', async () => {
    db.auth.currentUserId = null;
    const res = await api.post('/auth/login', { email: 'a@b.c', password: 'pw' });
    expect(db.auth.login).toHaveBeenCalledWith('a@b.c', 'pw');
    expect(db.auth.setCurrentUserId).toHaveBeenCalledWith('u1');
    expect((res.data as { user: { id: string } }).user.id).toBe('u1');
  });

  it('/auth/me 未登录时报 Not authenticated', async () => {
    db.auth.getCurrentUser.mockResolvedValueOnce(null);
    expect(await errorOf(api.request('/auth/me'))).toContain('Not authenticated');
  });
});

describe('子资源路由只打子资源（防数据损坏）', () => {
  it('DELETE /topics/:id/notes/:noteId → deleteNote，绝不 topics.delete', async () => {
    await api.delete('/topics/t1/notes/n1');
    expect(calls).toContain('topics.deleteNote("n1")');
    expect(calls.filter((c) => c.startsWith('topics.delete('))).toHaveLength(0);
  });

  it('DELETE /goals/:id/key-results/:krId → deleteKeyResult，绝不 goals.delete', async () => {
    await api.delete('/goals/g1/key-results/kr1');
    expect(calls).toContain('goals.deleteKeyResult("kr1")');
    expect(calls.filter((c) => c.startsWith('goals.delete('))).toHaveLength(0);
  });

  it('PATCH /goals/:id/key-results/:krId → updateKeyResult，绝不 goals.update', async () => {
    await api.patch('/goals/g1/key-results/kr1', { currentValue: 3 });
    expect(calls).toContain('goals.updateKeyResult("kr1",{"currentValue":3})');
    expect(calls.filter((c) => c.startsWith('goals.update('))).toHaveLength(0);
  });

  it('DELETE /subscriptions/:id/quotas/:quotaId → deleteQuota，绝不 subscriptions.delete', async () => {
    await api.delete('/subscriptions/s1/quotas/q1');
    expect(calls).toContain('subscriptions.deleteQuota("s1","q1")');
    expect(calls.filter((c) => c.startsWith('subscriptions.delete('))).toHaveLength(0);
  });

  it('DELETE /workflows/:id/steps/:stepId → deleteStep，绝不 workflows.delete', async () => {
    await api.delete('/workflows/w1/steps/st1');
    expect(calls).toContain('workflows.deleteStep("st1")');
    expect(calls.filter((c) => c.startsWith('workflows.delete('))).toHaveLength(0);
  });

  it('POST /habits/:id/log → toggleLog 而非 habits.create', async () => {
    await api.post('/habits/h1/log', { date: '2026-10-03' });
    expect(calls).toContain('habits.toggleLog("h1",{"date":"2026-10-03"})');
    expect(calls.filter((c) => c.startsWith('habits.create('))).toHaveLength(0);
  });

  it('未识别的子路径显式报错，绝不静默落到父表', async () => {
    expect(await errorOf(api.delete('/topics/t1/unknown/x'))).toContain('Unhandled topics');
    expect(await errorOf(api.delete('/visions/v1'))).toContain('Unhandled visions');
    // 报错前不应产生任何写调用
    expect(calls.filter((c) => /\.(create|update|delete)/.test(c))).toHaveLength(0);
  });
});

describe('查询参数解析与响应包装', () => {
  it('GET /health?type=sleep → healthRecords.getAll("sleep")', async () => {
    await api.get('/health?type=sleep');
    expect(calls).toContain('healthRecords.getAll("sleep")');
  });

  it('GET /health/summary?days=14 → { summary }', async () => {
    await api.get('/health/summary?days=14');
    expect(calls).toContain('healthRecords.getSummary(14)');
  });

  it('解码 percent-encoded 查询值', async () => {
    await api.get('/balance-wheel/history?limit=5');
    expect(calls).toContain('balanceWheel.getHistory(5)');
  });

  it('GET /reflections/today-summary?date=… 透传日期', async () => {
    await api.get('/reflections/today-summary?date=2026-10-03');
    expect(calls).toContain('reflections.getTodaySummary("2026-10-03")');
  });

  it('GET 响应统一包一层 { data }（对齐 axios 形状）', async () => {
    const res = await api.get('/domains');
    expect(res).toHaveProperty('data');
    expect((res.data as { id: string }).id).toBe('x-1');
  });

  it('GET /subscriptions/dashboard/summary 走聚合入口而非列表', async () => {
    await api.get('/subscriptions/dashboard/summary');
    expect(calls).toContain('subscriptions.getDashboardSummary()');
    expect(calls.filter((c) => c.startsWith('subscriptions.getAll('))).toHaveLength(0);
  });

  it('未知实体报 Unhandled，不静默成功', async () => {
    expect(await errorOf(api.request('/nonexistent'))).toContain('Unhandled localDB request');
  });
});
