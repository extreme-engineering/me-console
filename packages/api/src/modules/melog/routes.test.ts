import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildTestApp } from '../../test-utils.js';
import { melogRoutes } from './routes.js';
import { runDueMelogSchedules, computeNextRunAt } from './scheduler.js';
import { executeSkill } from './service.js';

const prisma = new PrismaClient();
const USER_ID = 'melog-test-user';

async function cleanup() {
  await prisma.meLogEntry.deleteMany({ where: { userId: USER_ID } });
  await prisma.meLogRun.deleteMany({ where: { userId: USER_ID } });
  await prisma.meLogSchedule.deleteMany({ where: { userId: USER_ID } });
  await prisma.meLogSkill.deleteMany({ where: { userId: USER_ID } });
  await prisma.meLogSource.deleteMany({ where: { userId: USER_ID } });
  await prisma.healthRecord.deleteMany({ where: { userId: USER_ID } });
  await prisma.todo.deleteMany({ where: { userId: USER_ID } });
  await prisma.periodicReview.deleteMany({ where: { userId: USER_ID } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
}

describe('MeLog Routes', () => {
  beforeAll(async () => {
    await cleanup();
    await prisma.user.create({
      data: { id: USER_ID, email: 'melog-test@example.com', password: 'hashed', name: 'MeLog Test' },
    });
  });

  beforeEach(async () => {
    await prisma.meLogEntry.deleteMany({ where: { userId: USER_ID } });
    await prisma.meLogSource.deleteMany({ where: { userId: USER_ID } });
    await prisma.meLogSchedule.deleteMany({ where: { userId: USER_ID } });
    await prisma.healthRecord.deleteMany({ where: { userId: USER_ID } });
    await prisma.todo.deleteMany({ where: { userId: USER_ID } });
    await prisma.periodicReview.deleteMany({ where: { userId: USER_ID } });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  async function createApp() {
    const app = await buildTestApp({ userId: USER_ID });
    await app.register(melogRoutes, { prefix: '/api/melog' });
    await app.ready();
    return app;
  }

  describe('数据源', () => {
    it('should create a source', async () => {
      const app = await createApp();
      const response = await app.inject({
        method: 'POST',
        url: '/api/melog/sources',
        payload: { name: '微信聊天记录', category: 'im', adapter: 'chatlog', endpoint: 'http://localhost:5030' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().source.adapter).toBe('chatlog');
      expect(response.json().source.status).toBe('disconnected');
    });

    it('should reject invalid endpoint scheme', async () => {
      const app = await createApp();
      const response = await app.inject({
        method: 'POST',
        url: '/api/melog/sources',
        payload: { name: 'X', category: 'im', adapter: 'chatlog', endpoint: 'ftp://evil.example.com' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should update and delete a source', async () => {
      const app = await createApp();
      const created = await app.inject({
        method: 'POST',
        url: '/api/melog/sources',
        payload: { name: 'Obsidian', category: 'note', adapter: 'obsidian' },
      });
      const id = created.json().source.id;

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/melog/sources/${id}`,
        payload: { status: 'connected' },
      });
      expect(patched.json().source.status).toBe('connected');

      const removed = await app.inject({ method: 'DELETE', url: `/api/melog/sources/${id}` });
      expect(removed.json().success).toBe(true);
    });
  });

  describe('Ingest 与条目', () => {
    it('should ingest entries with implicit source creation and stay idempotent', async () => {
      const app = await createApp();
      const payload = {
        source: { adapter: 'chatlog', name: '微信聊天记录', category: 'im' },
        entries: [
          {
            externalId: 'msg-001',
            category: 'im',
            type: 'chat-message',
            title: '与老张的对话',
            content: '最近压力有点大',
            actor: '我',
            occurredAt: new Date().toISOString(),
          },
        ],
      };

      const first = await app.inject({ method: 'POST', url: '/api/melog/ingest', payload });
      expect(first.statusCode).toBe(200);
      expect(first.json()).toMatchObject({ created: 1, updated: 0, skipped: 0 });

      const second = await app.inject({ method: 'POST', url: '/api/melog/ingest', payload });
      expect(second.json()).toMatchObject({ created: 0, updated: 1, skipped: 0 });

      const sources = await app.inject({ method: 'GET', url: '/api/melog/sources' });
      expect(sources.json().sources).toHaveLength(1);
      expect(sources.json().sources[0].entryCount).toBe(1);
      expect(sources.json().sources[0].status).toBe('connected');
    });

    it('should reject invalid category', async () => {
      const app = await createApp();
      const response = await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        payload: {
          source: { adapter: 'x', name: 'X' },
          entries: [{ category: 'browser-history', type: 't', title: 'T', occurredAt: new Date().toISOString() }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should filter entries by category and keyword', async () => {
      const app = await createApp();
      await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        payload: {
          source: { adapter: 'apple-health', name: 'Apple 健康', category: 'health' },
          entries: [
            {
              externalId: 'h-1',
              category: 'health',
              type: 'sleep',
              title: '睡眠 7.5 小时',
              payload: JSON.stringify({ value: 7.5, unit: 'hours' }),
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        payload: {
          source: { adapter: 'chatlog', name: '微信聊天记录', category: 'im' },
          entries: [
            {
              externalId: 'm-1',
              category: 'im',
              type: 'chat-message',
              title: '聊睡眠',
              content: '今晚早点睡',
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      });

      const byCategory = await app.inject({ method: 'GET', url: '/api/melog/entries?category=health' });
      expect(byCategory.json().total).toBe(1);

      const byKeyword = await app.inject({ method: 'GET', url: '/api/melog/entries?q=睡眠' });
      expect(byKeyword.json().total).toBe(2);
    });

    it('should return overview stats', async () => {
      const app = await createApp();
      await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        payload: {
          source: { adapter: 'obsidian', name: 'Obsidian', category: 'note' },
          entries: [
            {
              externalId: 'n-1',
              category: 'note',
              type: 'markdown-doc',
              title: '设计笔记',
              content: 'MeLog Standard 数据信封',
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      });

      const overview = await app.inject({ method: 'GET', url: '/api/melog/overview' });
      expect(overview.json().totalEntries).toBe(1);
      expect(overview.json().byCategory).toEqual(
        expect.arrayContaining([expect.objectContaining({ category: 'note', count: 1 })]),
      );
      expect(overview.json().sources[0]).toMatchObject({ total: 1, connected: 1 });
    });
  });

  describe('口述打卡', () => {
    const TEXT = '今天早上潮汐冥想15分钟，昨天睡眠7小时';

    it('parse 只解析不落库', async () => {
      const app = await createApp();
      const response = await app.inject({
        method: 'POST',
        url: '/api/melog/capture/parse',
        payload: { text: TEXT },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().items.map((i: { type: string }) => i.type)).toEqual(['meditation', 'sleep']);

      const entries = await app.inject({ method: 'GET', url: '/api/melog/entries' });
      expect(entries.json().total).toBe(0);
    });

    it('capture 双写时间线与健康记录，重复提交幂等', async () => {
      const app = await createApp();
      const first = await app.inject({ method: 'POST', url: '/api/melog/capture', payload: { text: TEXT } });
      expect(first.statusCode).toBe(201);
      expect(first.json()).toMatchObject({ created: 2, updated: 0, healthRecords: 2 });

      const entries = await app.inject({ method: 'GET', url: '/api/melog/entries?category=health' });
      expect(entries.json().total).toBe(2);
      expect(await prisma.healthRecord.count({ where: { userId: USER_ID } })).toBe(2);

      const second = await app.inject({ method: 'POST', url: '/api/melog/capture', payload: { text: TEXT } });
      expect(second.json()).toMatchObject({ created: 0, updated: 2, healthRecords: 0 });
      expect(await prisma.healthRecord.count({ where: { userId: USER_ID } })).toBe(2);
    });

    it('exclude 过滤取消勾选的条目', async () => {
      const app = await createApp();
      const response = await app.inject({
        method: 'POST',
        url: '/api/melog/capture',
        payload: { text: TEXT, exclude: [1] },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json().items).toHaveLength(1);
      expect(response.json().items[0].type).toBe('meditation');
      expect(await prisma.healthRecord.count({ where: { userId: USER_ID } })).toBe(1);
    });

    it('全部排除时返回 400', async () => {
      const app = await createApp();
      const response = await app.inject({
        method: 'POST',
        url: '/api/melog/capture',
        payload: { text: TEXT, exclude: [0, 1] },
      });
      expect(response.statusCode).toBe(400);
    });

    it('「待办：」前缀创建待办，不写时间线与健康记录', async () => {
      const app = await createApp();
      const response = await app.inject({
        method: 'POST',
        url: '/api/melog/capture',
        payload: { text: '待办：周五前交报告，笔记：今天读了一本好书' },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ created: 1, updated: 0, healthRecords: 0, todos: 1 });

      const todos = await prisma.todo.findMany({ where: { userId: USER_ID } });
      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe('周五前交报告');
      expect(todos[0].source).toBe('capture');

      const entries = await app.inject({ method: 'GET', url: '/api/melog/entries?category=note' });
      expect(entries.json().total).toBe(1);
      expect(entries.json().entries[0].content).toContain('一本好书');
      expect(await prisma.healthRecord.count({ where: { userId: USER_ID } })).toBe(0);
    });
  });

  describe('技能', () => {
    it('should auto-provision builtin skills', async () => {
      const app = await createApp();
      const response = await app.inject({ method: 'GET', url: '/api/melog/skills' });
      const slugs = response.json().skills.map((s: { slug: string }) => s.slug);
      expect(slugs).toEqual(expect.arrayContaining(['health-insight', 'knowledge-recall', 'life-recap']));
    });

    it('should forbid uninstalling builtin skills', async () => {
      const app = await createApp();
      await app.inject({ method: 'GET', url: '/api/melog/skills' });
      const skills = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug: 'health-insight' } });

      const response = await app.inject({ method: 'DELETE', url: `/api/melog/skills/${skills!.id}` });
      expect(response.statusCode).toBe(400);
    });

    it('should run life-recap and produce a report', async () => {
      const app = await createApp();
      await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        payload: {
          source: { adapter: 'chatlog', name: '微信聊天记录', category: 'im' },
          entries: [
            {
              externalId: 'm-2',
              category: 'im',
              type: 'chat-message',
              title: '与妈妈的对话',
              content: '周末回家吃饭',
              actor: '妈妈',
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      });
      await app.inject({ method: 'GET', url: '/api/melog/skills' });
      const skill = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug: 'life-recap' } });

      const response = await app.inject({ method: 'POST', url: `/api/melog/skills/${skill!.id}/run`, payload: {} });
      expect(response.statusCode).toBe(201);
      expect(response.json().run.status).toBe('succeeded');
      expect(response.json().report).toContain('## 生活复盘');
      expect(response.json().report).toContain('妈妈');

      const runs = await app.inject({ method: 'GET', url: '/api/melog/runs' });
      expect(runs.json().runs).toHaveLength(1);
    });

    it('should mark community skill runs as failed with explanation', async () => {
      const app = await createApp();
      const created = await app.inject({
        method: 'POST',
        url: '/api/melog/skills',
        payload: { slug: 'my-custom-skill', name: '自定义技能', source: 'custom' },
      });
      const skill = created.json().skill;

      const response = await app.inject({ method: 'POST', url: `/api/melog/skills/${skill.id}/run`, payload: {} });
      expect(response.json().run.status).toBe('failed');
    });
  });

  describe('定时调度', () => {
    it('should compute next run times for daily and interval kinds', () => {
      const from = new Date('2026-09-04T10:00:00');

      const daily = computeNextRunAt('daily', '09:00', null, from);
      expect(daily!.getDate()).toBe(5);
      expect(daily!.getHours()).toBe(9);

      const dailyToday = computeNextRunAt('daily', '23:00', null, from);
      expect(dailyToday!.getDate()).toBe(4);
      expect(dailyToday!.getHours()).toBe(23);

      const interval = computeNextRunAt('interval', null, 12, from);
      expect(interval!.getTime()).toBe(from.getTime() + 12 * 3600 * 1000);

      expect(computeNextRunAt('daily', 'bad', null, from)).toBeNull();
    });

    it('should reject invalid schedule payloads', async () => {
      const app = await createApp();
      await app.inject({ method: 'GET', url: '/api/melog/skills' });
      const skill = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug: 'life-recap' } });

      const missing = await app.inject({
        method: 'POST',
        url: '/api/melog/schedules',
        payload: { skillId: skill!.id, kind: 'daily' },
      });
      expect(missing.statusCode).toBe(400);

      const badTime = await app.inject({
        method: 'POST',
        url: '/api/melog/schedules',
        payload: { skillId: skill!.id, kind: 'daily', dailyAt: '25:99' },
      });
      expect(badTime.statusCode).toBe(400);
    });

    it('should upsert a daily schedule with a future nextRunAt', async () => {
      const app = await createApp();
      await app.inject({ method: 'GET', url: '/api/melog/skills' });
      const skill = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug: 'life-recap' } });

      const response = await app.inject({
        method: 'POST',
        url: '/api/melog/schedules',
        payload: { skillId: skill!.id, kind: 'daily', dailyAt: '09:00' },
      });
      expect(response.statusCode).toBe(200);
      const schedule = response.json().schedule;
      expect(schedule.enabled).toBe(true);
      expect(new Date(schedule.nextRunAt).getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('should run due schedules and advance nextRunAt', async () => {
      const app = await createApp();
      await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        payload: {
          source: { adapter: 'chatlog', name: '微信聊天记录', category: 'im' },
          entries: [
            {
              externalId: 'sched-1',
              category: 'im',
              type: 'chat-message',
              title: '与妈妈的对话',
              content: '周末回家吃饭',
              actor: '妈妈',
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      });
      await app.inject({ method: 'GET', url: '/api/melog/skills' });
      const skill = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug: 'life-recap' } });
      const overdue = new Date(Date.now() - 3600 * 1000);
      await prisma.meLogSchedule.create({
        data: { userId: USER_ID, skillId: skill!.id, kind: 'interval', intervalHours: 6, nextRunAt: overdue },
      });
      await prisma.meLogRun.deleteMany({ where: { userId: USER_ID } });

      const executed = await runDueMelogSchedules();
      expect(executed).toBe(1);

      const runs = await app.inject({ method: 'GET', url: '/api/melog/runs' });
      expect(runs.json().runs).toHaveLength(1);

      const schedule = await prisma.meLogSchedule.findFirst({ where: { userId: USER_ID } });
      expect(schedule!.lastRunAt).not.toBeNull();
      expect(schedule!.nextRunAt!.getTime()).toBeGreaterThan(Date.now());

      // 没有到期任务时不再执行
      const second = await runDueMelogSchedules();
      expect(second).toBe(0);
    });

    it('should delete a schedule', async () => {
      const app = await createApp();
      await app.inject({ method: 'GET', url: '/api/melog/skills' });
      const skill = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug: 'life-recap' } });
      await prisma.meLogSchedule.create({
        data: { userId: USER_ID, skillId: skill!.id, kind: 'interval', intervalHours: 6 },
      });

      const schedule = await prisma.meLogSchedule.findFirst({ where: { userId: USER_ID } });
      const response = await app.inject({ method: 'DELETE', url: `/api/melog/schedules/${schedule!.id}` });
      expect(response.json().success).toBe(true);
    });
  });

  describe('技能引擎（LLM）', () => {
    const ENV_KEYS = ['MELOG_LLM_BASE_URL', 'MELOG_LLM_API_KEY', 'MELOG_LLM_MODEL'] as const;
    let savedEnv: Record<string, string | undefined>;

    beforeEach(() => {
      savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
      for (const key of ENV_KEYS) delete process.env[key];
    });

    afterEach(() => {
      for (const key of ENV_KEYS) {
        if (savedEnv[key] !== undefined) process.env[key] = savedEnv[key];
        else delete process.env[key];
      }
    });

    async function seedOneEntry() {
      const app = await createApp();
      await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        payload: {
          source: { adapter: 'obsidian', name: 'Obsidian', category: 'note' },
          entries: [
            {
              externalId: 'engine-1',
              category: 'note',
              type: 'markdown-doc',
              title: '引擎测试笔记',
              content: 'MeLog LLM 运行器',
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      });
      await app.inject({ method: 'GET', url: '/api/melog/skills' });
      return app;
    }

    it('should validate skill config on patch', async () => {
      const app = await seedOneEntry();
      const skill = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug: 'life-recap' } });

      const bad = await app.inject({
        method: 'PATCH',
        url: `/api/melog/skills/${skill!.id}`,
        payload: { config: 'not-json' },
      });
      expect(bad.statusCode).toBe(400);

      const ok = await app.inject({
        method: 'PATCH',
        url: `/api/melog/skills/${skill!.id}`,
        payload: { config: JSON.stringify({ engine: 'llm' }) },
      });
      expect(ok.statusCode).toBe(200);
      expect(JSON.parse(ok.json().skill.config)).toEqual({ engine: 'llm' });
    });

    it('should fall back to the rule engine when LLM is forced but not configured', async () => {
      const app = await seedOneEntry();
      const skill = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug: 'life-recap' } });
      await app.inject({
        method: 'PATCH',
        url: `/api/melog/skills/${skill!.id}`,
        payload: { config: JSON.stringify({ engine: 'llm' }) },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/melog/skills/${skill!.id}/run`,
        payload: {},
      });
      expect(response.statusCode).toBe(201);
      expect(response.json().report).toContain('回退到规则引擎');
      expect(response.json().report).toContain('## 生活复盘');
      const stats = JSON.parse(response.json().run.stats);
      expect(stats.engine).toBe('rule');
    });

    it('should run with the LLM engine and record engine metadata', async () => {
      process.env.MELOG_LLM_BASE_URL = 'http://127.0.0.1:9/v1';
      process.env.MELOG_LLM_API_KEY = 'k';
      process.env.MELOG_LLM_MODEL = 'test-model';
      await seedOneEntry();
      await prisma.meLogRun.deleteMany({ where: { userId: USER_ID } });

      const { run, result } = await executeSkill(USER_ID, 'life-recap', undefined, undefined, undefined, {
        llmFetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
          void url;
          const body = JSON.parse(String(init?.body));
          expect(body.model).toBe('test-model');
          expect(JSON.stringify(body.messages)).toContain('引擎测试笔记');
          return new Response(
            JSON.stringify({ choices: [{ message: { content: '# 一句话总结\n\nLLM 版复盘正文。' } }] }),
            { status: 200 },
          );
        }) as typeof fetch,
      });

      expect(result).toContain('LLM 版复盘正文');
      const stats = JSON.parse(String(run.stats));
      expect(stats.engine).toBe('llm');
      expect(stats.model).toBe('test-model');
    });

    it('should use the rule engine on auto when no provider is configured', async () => {
      const app = await seedOneEntry();
      await prisma.meLogRun.deleteMany({ where: { userId: USER_ID } });
      const skill = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug: 'life-recap' } });

      const response = await app.inject({
        method: 'POST',
        url: `/api/melog/skills/${skill!.id}/run`,
        payload: {},
      });
      const stats = JSON.parse(response.json().run.stats);
      expect(stats.engine).toBe('rule');
    });
  });

  describe('MeLog → 反思闭环', () => {
    async function seedAndRun(slug: string, days?: number) {
      const app = await createApp();
      await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        payload: {
          source: { adapter: 'chatlog', name: '微信聊天记录', category: 'im' },
          entries: [
            {
              externalId: `loop-${slug}`,
              category: 'im',
              type: 'chat-message',
              title: '与妈妈的对话',
              content: '周末回家吃饭',
              actor: '妈妈',
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      });
      await app.inject({ method: 'GET', url: '/api/melog/skills' });
      const skill = await prisma.meLogSkill.findFirst({ where: { userId: USER_ID, slug } });
      const response = await app.inject({
        method: 'POST',
        url: `/api/melog/skills/${skill!.id}/run`,
        payload: days ? { days } : {},
      });
      return { app, response };
    }

    it('life-recap 运行后自动生成周期复盘草稿并回写 linkedReviewId', async () => {
      const { response } = await seedAndRun('life-recap', 7);
      expect(response.statusCode).toBe(201);

      const review = await prisma.periodicReview.findFirst({ where: { userId: USER_ID } });
      expect(review).not.toBeNull();
      expect(review!.period).toBe('weekly');
      expect(review!.insights).toContain('## 生活复盘');

      const summary = JSON.parse(review!.dataSummary || '{}') as {
        source?: string;
        runId?: string;
        engine?: string;
      };
      expect(summary.source).toBe('melog:life-recap');
      expect(summary.engine).toBe('rule');
      expect(summary.runId).toBe(response.json().run.id);

      const runStats = JSON.parse(String(response.json().run.stats));
      expect(runStats.linkedReviewId).toBe(review!.id);
    });

    it('config syncReview=false 时关闭同步', async () => {
      const app = await createApp();
      await app.inject({ method: 'GET', url: '/api/melog/skills' });
      await prisma.meLogSkill.updateMany({
        where: { userId: USER_ID, slug: 'life-recap' },
        data: { config: JSON.stringify({ syncReview: false }) },
      });
      await seedAndRun('life-recap');

      const count = await prisma.periodicReview.count({ where: { userId: USER_ID } });
      expect(count).toBe(0);
    });

    it('非复盘技能不生成周期复盘', async () => {
      await seedAndRun('health-insight');
      const count = await prisma.periodicReview.count({ where: { userId: USER_ID } });
      expect(count).toBe(0);
    });
  });

  describe('连接器令牌与搜索', () => {
    it('should create, use, scope and revoke connector tokens', async () => {
      const app = await createApp();
      const sourceA = await app.inject({
        method: 'POST',
        url: '/api/melog/sources',
        payload: { name: '源A', category: 'im', adapter: 'textlog' },
      });
      const sourceB = await app.inject({
        method: 'POST',
        url: '/api/melog/sources',
        payload: { name: '源B', category: 'note', adapter: 'obsidian' },
      });
      const idA = sourceA.json().source.id;
      const idB = sourceB.json().source.id;

      const created = await app.inject({
        method: 'POST',
        url: '/api/melog/tokens',
        payload: { name: '导入脚本', sourceId: idA },
      });
      expect(created.statusCode).toBe(201);
      const secret = created.json().secret as string;
      expect(secret).toMatch(/^melt_[0-9a-f]{48}$/);

      const listed = await app.inject({ method: 'GET', url: '/api/melog/tokens' });
      expect(listed.json().tokens).toHaveLength(1);
      expect(listed.json().tokens[0]).not.toHaveProperty('tokenHash');

      const authHeader = { Authorization: `Bearer ${secret}` };
      // 绑定数据源的令牌写入自己的源：成功
      const ok = await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        headers: authHeader,
        payload: {
          sourceId: idA,
          entries: [
            { externalId: 'tk-1', category: 'im', type: 'chat-message', title: '令牌导入', occurredAt: new Date().toISOString() },
          ],
        },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().created).toBe(1);

      // 内联指定其他数据源：403
      const inline = await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        headers: authHeader,
        payload: {
          source: { adapter: 'chatlog', name: 'X' },
          entries: [{ category: 'im', type: 'chat-message', title: 't', occurredAt: new Date().toISOString() }],
        },
      });
      expect(inline.statusCode).toBe(403);

      // 显式指向别的数据源：403
      const other = await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        headers: authHeader,
        payload: {
          sourceId: idB,
          entries: [{ category: 'note', type: 'markdown-doc', title: 't', occurredAt: new Date().toISOString() }],
        },
      });
      expect(other.statusCode).toBe(403);

      // 无效令牌：401
      const bad = await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        headers: { Authorization: 'Bearer melt_deadbeef' },
        payload: { sourceId: idA, entries: [] },
      });
      expect(bad.statusCode).toBe(401);

      // 吊销后：401
      const tokenId = created.json().token.id;
      await app.inject({ method: 'DELETE', url: `/api/melog/tokens/${tokenId}` });
      const after = await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        headers: authHeader,
        payload: { sourceId: idA, entries: [] },
      });
      expect(after.statusCode).toBe(401);
    });

    it('should search via FTS for 3+ char CJK keywords', async () => {
      const app = await createApp();
      await app.inject({
        method: 'POST',
        url: '/api/melog/ingest',
        payload: {
          source: { adapter: 'chatlog', name: '微信聊天记录', category: 'im' },
          entries: [
            {
              externalId: 'fts-1',
              category: 'im',
              type: 'chat-message',
              title: '与老王的对话',
              content: '明天上午同步一下项目进度',
              occurredAt: new Date().toISOString(),
            },
          ],
        },
      });

      const found = await app.inject({ method: 'GET', url: '/api/melog/entries?q=目进度' });
      expect(found.json().total).toBe(1);

      const missing = await app.inject({ method: 'GET', url: '/api/melog/entries?q=不存在的关键词呀' });
      expect(missing.json().total).toBe(0);
    });
  });

  describe('MCP 端点', () => {
    const mcpPost = (app: Awaited<ReturnType<typeof createApp>>, body: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/api/melog/mcp', payload: body });

    it('should respond to initialize', async () => {
      const app = await createApp();
      const response = await mcpPost(app, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      });

      const result = response.json().result;
      expect(result.protocolVersion).toBe('2024-11-05');
      expect(result.serverInfo.name).toBe('melog');
    });

    it('should list tools', async () => {
      const app = await createApp();
      const response = await mcpPost(app, { jsonrpc: '2.0', id: 2, method: 'tools/list' });

      const names = response.json().result.tools.map((t: { name: string }) => t.name);
      expect(names).toEqual(
        expect.arrayContaining(['melog_get_overview', 'melog_query_entries', 'melog_ingest_entries', 'melog_run_skill']),
      );
    });

    it('should ingest and query via tools/call', async () => {
      const app = await createApp();

      const ingest = await mcpPost(app, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'melog_ingest_entries',
          arguments: {
            adapter: 'chatlog',
            name: '微信聊天记录',
            category: 'im',
            entries: [
              {
                externalId: 'mcp-1',
                category: 'im',
                type: 'chat-message',
                title: 'MCP 写入',
                content: '通过 MCP 工具写入的条目',
                occurredAt: new Date().toISOString(),
              },
            ],
          },
        },
      });
      expect(JSON.parse(ingest.json().result.content[0].text)).toMatchObject({ created: 1 });

      const query = await mcpPost(app, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'melog_query_entries',
          arguments: { category: 'im', q: 'MCP' },
        },
      });
      const queryResult = JSON.parse(query.json().result.content[0].text);
      expect(queryResult.entries).toHaveLength(1);
      expect(queryResult.entries[0].title).toBe('MCP 写入');
    });

    it('should run a skill via tools/call', async () => {
      const app = await createApp();
      const response = await mcpPost(app, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'melog_run_skill', arguments: { slug: 'life-recap', days: 7 } },
      });

      const parsed = JSON.parse(response.json().result.content[0].text);
      expect(parsed.status).toBe('succeeded');
    });

    it('should return JSON-RPC error for unknown methods', async () => {
      const app = await createApp();
      const response = await mcpPost(app, { jsonrpc: '2.0', id: 6, method: 'resources/list' });

      expect(response.json().error.code).toBe(-32603);
      expect(response.json().error.message).toContain('未知方法');
    });

    it('should reject malformed requests', async () => {
      const app = await createApp();
      const response = await mcpPost(app, { id: 7, method: 'tools/list' });

      expect(response.json().error.code).toBe(-32600);
    });
  });
});
