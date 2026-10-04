import { describe, expect, it } from 'vitest';
import {
  collectDida365Entries,
  fetchCheckinRecords,
  mapHabitCheckins,
  mapTaskNotes,
  parseDidaDate,
  runDida365Connector,
  stampToDay,
  type DidaTask,
} from './dida365.js';
import { MeLogIngestClient, type IngestEntryInput } from '../lib/ingest.js';

const HABITS = [
  { id: 'habit_run', name: '跑步', status: 0, goal: 1, unit: '次' },
  { id: 'habit_read', name: '阅读', status: 0, goal: 1 },
];

// 真实接口形态：{checkins: {habitId: [打卡条目]}}，条目含 checkinStamp（YYYYMMDD）
const CHECKINS_RESPONSE = {
  checkins: {
    habit_run: [
      { id: 'c1', habitId: 'habit_run', checkinStamp: 20260903, checkinTime: '2026-09-03T01:00:00.492+0000', value: 1, goal: 1, status: 2 },
      { id: 'c2', habitId: 'habit_run', checkinStamp: 20260901, checkinTime: '2026-09-01T01:00:00.000+0000', value: 1 },
      { id: 'c3', habitId: 'habit_run', checkinStamp: 20200101, checkinTime: '2020-01-01T01:00:00.000+0000' }, // 窗口外
      { id: 'c4', habitId: 'habit_run' }, // 无日期，应跳过
    ],
    habit_unknown: [{ id: 'c5', habitId: 'habit_unknown', checkinStamp: 20260902, checkinTime: '2026-09-02T00:00:00.000+0000', value: 1 }],
  },
};

describe('dida365 适配器', () => {
  it('should parse dida date strings with +0000 timezone', () => {
    expect(parseDidaDate('2026-09-03T09:00:00.000+0800')?.toISOString()).toBe('2026-09-03T01:00:00.000Z');
    expect(parseDidaDate('2026-09-03T09:00:00.000+08:00')?.toISOString()).toBe('2026-09-03T01:00:00.000Z');
    expect(parseDidaDate(undefined)).toBeNull();
    expect(parseDidaDate('bad')).toBeNull();
  });

  it('should convert checkinStamp integers to day keys', () => {
    expect(stampToDay(20260903)).toBe('2026-09-03');
    expect(stampToDay(20250224)).toBe('2025-02-24');
    expect(stampToDay(undefined)).toBeNull();
    expect(stampToDay(123)).toBeNull();
  });

  it('should map checkins to daily entries with window filtering', () => {
    const entries = mapHabitCheckins(HABITS, [
      { habitId: 'habit_run', checkins: CHECKINS_RESPONSE.checkins.habit_run },
      { habitId: 'habit_unknown', checkins: CHECKINS_RESPONSE.checkins.habit_unknown },
    ], '2026-08-15', '2026-09-12');
    expect(entries).toHaveLength(3); // 09-03、09-01、未知习惯 09-02（01-01 窗口外、无日期跳过）
    expect(entries[0]).toMatchObject({
      externalId: 'dida365-habit-habit_run-2026-09-03',
      category: 'custom',
      type: 'habit-checkin',
      title: '习惯打卡：跑步',
      tags: 'dida365,habit',
    });
    expect(entries[0].occurredAt).toBe('2026-09-03T01:00:00.492Z');
    expect(JSON.parse(entries[0].payload!)).toMatchObject({ habitId: 'habit_run', value: 1, status: 2 });
    expect(entries[2].title).toBe('习惯打卡：habit_unknown');
  });

  it('should map task notes and skip tasks without content', () => {
    const projects = new Map([
      ['proj_work', '工作'],
      ['inbox1021432222', '收集箱'],
    ]);
    const tasks: DidaTask[] = [
      {
        id: 'task_1',
        projectId: 'proj_work',
        title: '写周报',
        content: '重点写 KPI 部分',
        completedTime: '2026-09-03T18:00:00.000+0800',
        createdTime: '2026-09-01T09:00:00.000+0800',
      },
      { id: 'task_2', projectId: 'proj_life', title: '买菜', desc: '番茄、鸡蛋', dueDate: '2026-09-04T12:00:00.000+0800' },
      { id: 'task_3', projectId: 'proj_life', title: '无备注' },
      { title: '缺 id', content: '会被跳过' },
    ];

    const entries = mapTaskNotes(tasks, projects);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      externalId: 'dida365-task-task_1',
      category: 'note',
      type: 'task-note',
      title: '写周报',
      content: '重点写 KPI 部分',
      tags: 'dida365,todo,工作',
    });
    // 锚点优先级：completedTime > dueDate
    expect(entries[0].occurredAt).toBe('2026-09-03T10:00:00.000Z');
    expect(entries[1].occurredAt).toBe('2026-09-04T04:00:00.000Z');
  });

  it('should query checkins by habitIds and fall back to GET when POST fails', async () => {
    const calls: string[] = [];
    const bodies: unknown[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      calls.push(`${init?.method || 'GET'} ${href}`);
      expect((init?.headers as Record<string, string>).Cookie).toBe('t=token_abc');
      if (href.includes('/api/v2/habitCheckins/query')) {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response('route gone', { status: 404 });
      }
      if (href.includes('/api/v2/habitCheckins?')) {
        return jsonResponse(CHECKINS_RESPONSE);
      }
      throw new Error(`unexpected fetch: ${href}`);
    }) as typeof fetch;

    const records = await fetchCheckinRecords(
      'https://api.dida365.com',
      'token_abc',
      ['habit_run', 'habit_read'],
      '2026-08-15',
      '2026-09-12',
      fetchImpl,
    );
    expect(bodies[0]).toEqual({ habitIds: ['habit_run', 'habit_read'] });
    expect(records[0].habitId).toBe('habit_run');
    expect(records[0].checkins).toHaveLength(4);
    expect(calls.some((c) => c.startsWith('GET ') && c.includes('/habitCheckins?'))).toBe(true);
  });

  it('should give a friendly error on invalid token', async () => {
    const fetchImpl = (async () => new Response('unauthorized', { status: 401 })) as typeof fetch;
    await expect(
      fetchCheckinRecords('https://api.dida365.com', 'expired', ['habit_run'], '2026-08-15', '2026-09-12', fetchImpl),
    ).rejects.toThrow('token 无效或已过期');
  });

  it('should collect from v3 batch snapshot and push both categories', async () => {
    const pushed: { category: string; entries: IngestEntryInput[] }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes('/api/v2/habits')) return jsonResponse(HABITS);
      if (href.includes('/api/v2/habitCheckins/query')) {
        return jsonResponse(CHECKINS_RESPONSE);
      }
      if (href.includes('/api/v3/batch/check/0')) {
        return jsonResponse({
          inboxId: 'inbox1021432222',
          projectProfiles: [
            { id: 'proj_work', name: '工作' },
            { id: 'proj_empty', name: '空清单' },
          ],
          syncTaskBean: {
            update: [
              { id: 'task_1', projectId: 'proj_work', title: '写周报', content: '重点写 KPI', dueDate: '2026-09-04T12:00:00.000+0800' },
              { id: 'task_inbox', projectId: 'inbox1021432222', title: '收件箱任务', content: '收件箱备注' },
              { id: 'task_no_note', title: '无备注' },
            ],
            add: [],
          },
        });
      }
      throw new Error(`unexpected fetch: ${href} (${init?.method || 'GET'})`);
    }) as typeof fetch;

    const collected = await collectDida365Entries({
      token: 'token_abc',
      apiBase: 'https://api.dida365.com',
      backfillDays: 30,
      // 注入固定窗口终点：夹具日期为 2026-09-01 ~ 09-03，跟随真实时间会漂出 30 天窗口
      today: '2026-09-10T00:00:00.000Z',
      fetchImpl,
    });
    expect(collected.habitEntries).toHaveLength(3);
    expect(collected.taskEntries).toHaveLength(2);
    expect(collected.habits).toBe(2);

    const client = new MeLogIngestClient({
      apiUrl: 'http://127.0.0.1:3001',
      fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        pushed.push({ category: body.source.category, entries: body.entries });
        return new Response(JSON.stringify({ sourceId: 's', created: body.entries.length, updated: 0, skipped: 0 }), {
          status: 200,
        });
      }) as typeof fetch,
    });

    const result = await runDida365Connector({ token: 'token_abc', client, fetchImpl, today: '2026-09-10T00:00:00.000Z' });
    expect(result.created).toBe(5);
    expect(result.tasks).toBe(2);
    expect(pushed.map((p) => p.category).sort()).toEqual(['custom', 'note']);
    expect(pushed.find((p) => p.category === 'note')!.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalId: 'dida365-task-task_inbox', tags: 'dida365,todo,收集箱' }),
      ]),
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
