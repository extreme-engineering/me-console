/**
 * supabaseAdapter 契约与安全边界回归测试。
 *
 * 重点防护历史事故：子资源 DELETE/PATCH 曾按 segs[1] 解析、落到父表执行，
 * 导致「删一条笔记 → 删掉整个主题」。这里用 PostgREST 桩验证每条子资源
 * 路由只打各自的子表，并且未实现的子路径显式 501、绝不落到父表。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fakeSupabase, queries } = vi.hoisted(() => {
  class FakeQuery {
    table: string;
    op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
    payload?: unknown;
    filters: unknown[][] = [];
    private singleCalled = false;

    constructor(table: string) {
      this.table = table;
      queries.push(this);
    }

    select(...args: unknown[]) {
      this.filters.push(['select', ...args]);
      return this;
    }
    insert(payload: unknown) {
      this.op = 'insert';
      this.payload = payload;
      return this;
    }
    update(payload: unknown) {
      this.op = 'update';
      this.payload = payload;
      return this;
    }
    upsert(payload: unknown, opts?: unknown) {
      this.op = 'upsert';
      this.payload = payload;
      this.filters.push(['upsert-opts', opts]);
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    eq(...a: unknown[]) { this.filters.push(['eq', ...a]); return this; }
    gte(...a: unknown[]) { this.filters.push(['gte', ...a]); return this; }
    lte(...a: unknown[]) { this.filters.push(['lte', ...a]); return this; }
    lt(...a: unknown[]) { this.filters.push(['lt', ...a]); return this; }
    order(...a: unknown[]) { this.filters.push(['order', ...a]); return this; }
    limit(...a: unknown[]) { this.filters.push(['limit', ...a]); return this; }
    range(...a: unknown[]) { this.filters.push(['range', ...a]); return this; }
    in(...a: unknown[]) { this.filters.push(['in', ...a]); return this; }
    or(...a: unknown[]) { this.filters.push(['or', ...a]); return this; }
    single() { this.singleCalled = true; return this; }
    maybeSingle() { this.singleCalled = true; return this; }

    // thenable：await 时按 op 返回固定桩数据
    private rowFor() {
      if (this.table === 'health_records') {
        return { id: 'row-1', type: 'sleep', value: 7.5, unit: 'hours', recordedAt: '2026-09-14T00:00:00Z' };
      }
      if (this.table === 'habit_logs') return { id: 'row-1', habit: { title: '冥想' } };
      if (this.table === 'todos') return { id: 'row-1', title: '待办' };
      return { id: 'row-1' };
    }

    then(resolve: (v: unknown) => void) {
      const single = this.singleCalled;
      // habit_logs 的单条查询用于「当天是否已打卡」判断，桩为未打卡以便覆盖插入分支
      const singleRow = this.table === 'habit_logs' ? null : this.rowFor();
      const data =
        this.op === 'select'
          ? single
            ? singleRow
            : [this.rowFor()]
          : this.op === 'delete'
            ? null
            : { id: 'row-1' };
      resolve({ data, error: null, count: this.op === 'select' ? 1 : null });
    }
  }

  const queries: FakeQuery[] = [];
  const fakeSupabase = {
    from: (table: string) => new FakeQuery(table),
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1', email: 'u@example.com' } } }),
      signInWithPassword: async () => ({ data: {}, error: null }),
    },
  };

  return { fakeSupabase, queries };
});

vi.mock('../supabase/client', () => ({
  supabase: fakeSupabase,
  supabaseUrl: 'http://localhost',
  supabaseAnonKey: 'anon',
  getSupabaseUrl: () => 'http://localhost',
}));

import { supabaseAdapter } from './supabaseAdapter';

async function statusOf(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
    return undefined;
  } catch (e) {
    return (e as { status?: number }).status;
  }
}

beforeEach(() => {
  queries.length = 0;
});

describe('子资源路由只打子表（防数据损坏）', () => {
  it('DELETE /topics/:id/notes/:noteId → topic_notes，绝不碰 topics', async () => {
    await supabaseAdapter.delete('/topics/t1/notes/n1');
    const tables = queries.map((q) => q.table);
    expect(tables).toContain('topic_notes');
    expect(tables).not.toContain('topics');
    const q = queries[0];
    expect(q.op).toBe('delete');
    expect(q.filters).toContainEqual(['eq', 'id', 'n1']);
    expect(q.filters).toContainEqual(['eq', 'topicId', 't1']);
  });

  it('DELETE /goals/:id/key-results/:krId → key_results，绝不碰 goals', async () => {
    await supabaseAdapter.delete('/goals/g1/key-results/kr1');
    const tables = queries.map((q) => q.table);
    expect(tables).toContain('key_results');
    expect(tables).not.toContain('goals');
    expect(queries[0].filters).toContainEqual(['eq', 'goalId', 'g1']);
  });

  it('DELETE /subscriptions/:id/quotas/:quotaId → quota_definitions，绝不碰 subscriptions', async () => {
    await supabaseAdapter.delete('/subscriptions/s1/quotas/q1');
    const tables = queries.map((q) => q.table);
    expect(tables).toContain('quota_definitions');
    expect(tables).not.toContain('subscriptions');
    expect(queries[0].filters).toContainEqual(['eq', 'subscriptionId', 's1']);
  });

  it('DELETE /workflows/:id/steps/:stepId → workflow_steps，绝不碰 workflows', async () => {
    await supabaseAdapter.delete('/workflows/w1/steps/st1');
    const tables = queries.map((q) => q.table);
    expect(tables).toContain('workflow_steps');
    expect(tables).not.toContain('workflows');
    expect(queries[0].filters).toContainEqual(['eq', 'workflowId', 'w1']);
  });

  it('POST /workflows/:id/connections → workflow_connections 且带 userId', async () => {
    await supabaseAdapter.post('/workflows/w1/connections', {
      sourceStepId: 'a',
      targetStepId: 'b',
    });
    const q = queries[0];
    expect(q.table).toBe('workflow_connections');
    expect(q.op).toBe('insert');
    expect(q.payload).toMatchObject({ workflowId: 'w1', userId: 'u1', sourceStepId: 'a', targetStepId: 'b' });
  });

  it('POST /topics/:id/notes → topic_notes 且带 topicId + userId', async () => {
    await supabaseAdapter.post('/topics/t1/notes', { content: '想法', noteType: 'reflection' });
    const q = queries[0];
    expect(q.table).toBe('topic_notes');
    expect(q.payload).toMatchObject({ topicId: 't1', userId: 'u1', content: '想法', noteType: 'reflection' });
  });

  it('未实现的子路径显式 501，绝不落到父表', async () => {
    expect(await statusOf(supabaseAdapter.delete('/topics/t1/unknown/x'))).toBe(501);
    expect(await statusOf(supabaseAdapter.patch('/goals/g1/whatever', {}))).toBe(501);
    expect(await statusOf(supabaseAdapter.delete('/visions/v1'))).toBe(501);
    // 501 之前不应执行任何写操作
    expect(queries.every((q) => q.op === 'select' || q.op === 'delete')).toBe(true);
  });

  it('POST /habits/:id/log 走 habit_logs 切换打卡', async () => {
    await supabaseAdapter.post('/habits/h1/log', { date: '2026-09-14' });
    // 先查当天日志（无），再插入
    expect(queries[0].table).toBe('habit_logs');
    expect(queries[0].op).toBe('select');
    const insert = queries.find((q) => q.op === 'insert');
    expect(insert?.table).toBe('habit_logs');
    expect(insert?.payload).toMatchObject({ habitId: 'h1', userId: 'u1' });
    const result = (await supabaseAdapter.post('/habits/h1/log', { date: '2026-09-14' })) as {
      data: { logged: boolean };
    };
    expect(result.data.logged).toBe(true);
  });
});

describe('响应形状契约（key 映射对齐 fastify）', () => {
  it('GET /mindsets → { slogans }', async () => {
    const res = await supabaseAdapter.get('/mindsets');
    expect(res.data).toEqual({ slogans: [{ id: 'row-1' }] });
    expect(queries[0].table).toBe('mindset_slogans');
  });

  it('GET /reading → { items }', async () => {
    const res = await supabaseAdapter.get('/reading');
    expect(res.data).toEqual({ items: [{ id: 'row-1' }] });
    expect(queries[0].table).toBe('reading_items');
  });

  it('GET /health/summary → { summary: <按类型聚合对象> }', async () => {
    const res = (await supabaseAdapter.get('/health/summary?days=7')) as {
      data: { summary: Record<string, { avg: number; count: number; latest: number | null }> };
    };
    expect(res.data.summary.sleep).toEqual({ avg: 7.5, count: 1, latest: 7.5 });
    expect(queries[0].table).toBe('health_records');
  });

  it('GET /balance-wheel/history → { scores }（含 limit 与倒序）', async () => {
    const res = await supabaseAdapter.get('/balance-wheel/history?limit=20');
    expect(res.data).toEqual({ scores: [{ id: 'row-1' }] });
    expect(queries[0].table).toBe('balance_wheel_scores');
    expect(queries[0].filters).toContainEqual(['limit', 20]);
    expect(queries[0].filters).toContainEqual(['order', 'createdAt', { ascending: false }]);
  });

  it('GET /visions → { vision }（单条 effective）', async () => {
    const res = await supabaseAdapter.get('/visions');
    expect(res.data).toEqual({ vision: { id: 'row-1' } });
  });

  it('GET /reflections/today-summary → 聚合结构', async () => {
    const res = (await supabaseAdapter.get('/reflections/today-summary?date=2026-09-14')) as {
      data: { date: string; todos: { total: number }; habits: { total: number }; health: { total: number }; summary: string };
    };
    expect(res.data.date).toBe('2026-09-14');
    expect(res.data.todos).toHaveProperty('total');
    expect(res.data.habits).toHaveProperty('total');
    expect(res.data.health).toHaveProperty('total');
    expect(typeof res.data.summary).toBe('string');
  });
});

describe('写入清洗（mock 伪字段与嵌入字段）', () => {
  it('PATCH /todos/:id { mock: false } 为 no-op，不触发 update', async () => {
    const res = (await supabaseAdapter.patch('/todos/t1', { mock: false })) as { data: { todo: unknown } };
    expect(res.data).toHaveProperty('todo');
    expect(queries.every((q) => q.op === 'select')).toBe(true);
  });

  it('PATCH /topics/:id { isMock: false, mock: false } → 落库 isMock 且剔除 mock', async () => {
    await supabaseAdapter.patch('/topics/t1', { isMock: false, mock: false });
    const update = queries.find((q) => q.op === 'update');
    expect(update?.payload).toEqual({ isMock: false });
  });
});
