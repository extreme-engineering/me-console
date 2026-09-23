/**
 * onboarding 纯逻辑与步骤注册表回归测试。
 *
 * 覆盖：计数解析（命名键 / 裸数组 / 异常）、模式门禁（melog 与 brand）、
 * 跳过状态持久化、loadStepStatuses 聚合与 progressOf 进度计算。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  responses: new Map<string, unknown>(),
  mode: 'supabase' as string,
}));

vi.mock('./api', () => ({
  default: {
    get: async (url: string) => {
      if (!h.responses.has(url)) {
        throw Object.assign(new Error('not found'), { response: { status: 404 } });
      }
      return { data: h.responses.get(url) };
    },
  },
  get useLocalMode() {
    return h.mode;
  },
}));

import {
  ONBOARDING_STEPS,
  loadStepStatuses,
  progressOf,
  loadSkips,
  saveSkip,
  clearSkips,
} from './onboarding';

const stepById = (id: string) => {
  const step = ONBOARDING_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`missing step: ${id}`);
  return step;
};

describe('check 计数解析', () => {
  beforeEach(() => {
    h.responses.clear();
    h.mode = 'supabase';
    clearSkips();
  });

  it('命名键计数：/domains → { domains }', async () => {
    h.responses.set('/domains', { domains: [{ id: '1' }, { id: '2' }] });
    await expect(stepById('domains').check()).resolves.toBe(2);
  });

  it('裸数组兜底：数据本身是数组时也计数', async () => {
    h.responses.set('/domains', [{ id: '1' }]);
    await expect(stepById('domains').check()).resolves.toBe(1);
  });

  it('键缺失返回 0，不抛错', async () => {
    h.responses.set('/domains', {});
    await expect(stepById('domains').check()).resolves.toBe(0);
  });

  it('请求失败返回 null（该步隐藏），而非崩溃', async () => {
    await expect(stepById('domains').check()).resolves.toBeNull();
  });

  it('vision：有内容算 1，空内容 / 缺失算 0', async () => {
    h.responses.set('/visions', { vision: { content: '成为独立开发者' } });
    await expect(stepById('vision').check()).resolves.toBe(1);

    h.responses.set('/visions', { vision: { content: '   ' } });
    await expect(stepById('vision').check()).resolves.toBe(0);

    h.responses.set('/visions', { vision: null });
    await expect(stepById('vision').check()).resolves.toBe(0);
  });

  it('reading 用 items 键、health 用 records 键', async () => {
    h.responses.set('/reading', { items: [{ id: 'a' }] });
    h.responses.set('/health', { records: [{ id: '1' }, { id: '2' }, { id: '3' }] });
    await expect(stepById('reading').check()).resolves.toBe(1);
    await expect(stepById('health').check()).resolves.toBe(3);
  });

  it('subscriptions：Fastify 分页 data 键与 supabase subscriptions 键都识别', async () => {
    h.responses.set('/subscriptions', { data: [{ id: 's1' }], pagination: {} });
    await expect(stepById('subscriptions').check()).resolves.toBe(1);

    h.responses.set('/subscriptions', { subscriptions: [{ id: 's2' }] });
    await expect(stepById('subscriptions').check()).resolves.toBe(1);

    h.responses.set('/subscriptions', { data: [], pagination: {} });
    await expect(stepById('subscriptions').check()).resolves.toBe(0);
  });
});

describe('数据模式门禁', () => {
  beforeEach(() => {
    h.responses.clear();
    h.mode = 'supabase';
    clearSkips();
  });

  it('melog：supabase 模式读取 overview 的 sources[0].total', async () => {
    h.responses.set('/melog/overview', { sources: [{ total: 4, connected: 2, error: 0 }] });
    await expect(stepById('melog').check()).resolves.toBe(4);
  });

  it('melog：local 模式直接隐藏', async () => {
    h.mode = 'local';
    h.responses.set('/melog/overview', { sources: [{ total: 4 }] });
    await expect(stepById('melog').check()).resolves.toBeNull();
  });

  it('brand：仅 remote 模式可用，其余隐藏', async () => {
    h.responses.set('/brand/pillars', { pillars: [{ id: 'p1' }] });
    await expect(stepById('brand').check()).resolves.toBeNull();

    h.mode = 'remote';
    await expect(stepById('brand').check()).resolves.toBe(1);
  });
});

describe('loadStepStatuses 聚合', () => {
  beforeEach(() => {
    h.responses.clear();
    h.mode = 'supabase';
    clearSkips();
  });

  it('null 步骤被过滤，已录入为 filled，跳过为 skipped，其余 todo', async () => {
    // 只有部分端点有数据：/melog /brand 404（隐藏）
    h.responses.set('/domains', { domains: [{ id: '1' }] });
    h.responses.set('/goals', { goals: [] });
    h.responses.set('/todos', { todos: [] });

    const statuses = await loadStepStatuses();
    const ids = statuses.map((s) => s.step.id);
    expect(ids).not.toContain('melog');
    expect(ids).not.toContain('brand');

    expect(statuses.find((s) => s.step.id === 'domains')?.state).toBe('filled');
    expect(statuses.find((s) => s.step.id === 'goals')?.state).toBe('todo');

    saveSkip('goals', true);
    const withSkip = await loadStepStatuses();
    expect(withSkip.find((s) => s.step.id === 'goals')?.state).toBe('skipped');
  });

  it('已录入的步骤即便被跳过也优先显示为 filled', async () => {
    h.responses.set('/domains', { domains: [{ id: '1' }] });
    saveSkip('domains', true);
    const statuses = await loadStepStatuses();
    expect(statuses.find((s) => s.step.id === 'domains')?.state).toBe('filled');
  });
});

describe('progressOf', () => {
  it('按 filled 数量计算进度', () => {
    const statuses = [
      { state: 'filled', count: 1, step: { id: 'a' } },
      { state: 'skipped', count: 0, step: { id: 'b' } },
      { state: 'todo', count: 0, step: { id: 'c' } },
    ] as never[];
    expect(progressOf(statuses)).toEqual({ total: 3, done: 1, pending: 2, percent: 33 });
  });

  it('无可用步骤时进度为 100%', () => {
    expect(progressOf([])).toEqual({ total: 0, done: 0, pending: 0, percent: 100 });
  });
});

describe('跳过状态持久化', () => {
  beforeEach(() => {
    clearSkips();
  });

  it('saveSkip / loadSkips 往返', () => {
    expect(loadSkips().size).toBe(0);
    saveSkip('goals', true);
    saveSkip('habits', true);
    expect(loadSkips()).toEqual(new Set(['goals', 'habits']));
    saveSkip('goals', false);
    expect(loadSkips()).toEqual(new Set(['habits']));
  });

  it('损坏的存储内容不会抛错', () => {
    localStorage.setItem('meos.onboarding.skips', '{broken');
    expect(loadSkips().size).toBe(0);
    localStorage.setItem('meos.onboarding.skips', JSON.stringify(['a', 1, null, 'b']));
    expect(loadSkips()).toEqual(new Set(['a', 'b']));
  });
});
