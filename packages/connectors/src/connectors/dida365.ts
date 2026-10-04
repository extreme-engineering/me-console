import { MeLogIngestClient, type IngestEntryInput, type IngestSummary } from '../lib/ingest.js';

/**
 * 滴答清单（Dida365）适配器。
 *
 * ⚠️ 接入说明：习惯打卡与任务备注均来自滴答清单 Web 端使用的非官方接口
 * （api.dida365.com，认证使用浏览器 Cookie 中的 `t` token）。
 * 该接口不受官方 SLA 保护，可能随版本变动；token 仅在本机使用，不落日志。
 *
 * 2026-09 实测（Web 端同款路由）：
 * - 习惯：GET /api/v2/habits
 * - 打卡：POST /api/v2/habitCheckins/query，body {habitIds}，返回 {checkins:{habitId:[…]}}
 *   （GET habitCheckins?startDate&endDate 在服务端已 500）
 * - 任务：GET /api/v3/batch/check/0，任务在 syncTaskBean.update/add，
 *   清单名在 projectProfiles（v2 的 /project 为 405、/api/v2/batch/check/0 为 403）
 */

export interface DidaHabit {
  id?: string;
  name?: string;
  status?: number;
  totalCheckIns?: number;
  goal?: number;
  unit?: string;
  archivedTime?: string;
  [key: string]: unknown;
}

export interface DidaCheckin {
  id?: string;
  habitId?: string;
  /** 打卡日，YYYYMMDD 整数（账号本地时区） */
  checkinStamp?: number;
  checkinTime?: string;
  opTime?: string;
  value?: number;
  goal?: number;
  status?: number;
  [key: string]: unknown;
}

export interface DidaCheckinRecord {
  habitId?: string;
  checkins?: DidaCheckin[];
}

export interface DidaTask {
  id?: string;
  projectId?: string;
  title?: string;
  content?: string;
  desc?: string;
  status?: number;
  completedTime?: string;
  dueDate?: string;
  createdTime?: string;
  [key: string]: unknown;
}

export interface DidaProjectProfile {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface DidaBatchSnapshot {
  inboxId?: string;
  syncTaskBean?: { add?: DidaTask[]; update?: DidaTask[]; [key: string]: unknown };
  projectProfiles?: DidaProjectProfile[];
  [key: string]: unknown;
}

export interface Dida365ConnectorOptions {
  /** 浏览器 Cookie 中的 t token */
  token: string;
  /** MeOS 推送客户端；dry-run 模式可省略 */
  client?: MeLogIngestClient;
  /** API 根地址，默认 https://api.dida365.com（国际端 https://api.ticktick.com） */
  apiBase?: string;
  /** 数据源显示名，默认 滴答清单 */
  sourceName?: string;
  /** 打卡回溯天数，默认 30 */
  backfillDays?: number;
  /** 回溯窗口终点（ISO 日期；缺省取当前时间，测试注入固定值以保持确定性） */
  today?: string;
  /** 是否同步习惯打卡，默认 true */
  includeHabits?: boolean;
  /** 是否同步任务备注，默认 true */
  includeTasks?: boolean;
  fetchImpl?: typeof fetch;
}

export interface Dida365CollectResult {
  habitEntries: IngestEntryInput[];
  taskEntries: IngestEntryInput[];
  habits: number;
  from: string;
  to: string;
}

export interface Dida365SyncResult extends IngestSummary, Dida365CollectResult {
  tasks: number;
}

const DAY_MS = 24 * 3600 * 1000;
const DEFAULT_API_BASE = 'https://api.dida365.com';
const INBOX_NAME = '收集箱';

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 解析滴答清单时间字符串（兼容 +0000 无冒号时区） */
export function parseDidaDate(value?: string): Date | null {
  if (!value) return null;
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** checkinStamp（YYYYMMDD 整数）→ YYYY-MM-DD */
export function stampToDay(stamp?: number): string | null {
  if (!stamp || stamp < 19000101 || stamp > 99991231) return null;
  const raw = String(stamp);
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Cookie: `t=${token}`,
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    Accept: 'application/json',
  };
}

async function fetchDidaJson(url: string, token: string, init: RequestInit, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    ...init,
    headers: { ...authHeaders(token), ...(init.headers as Record<string, string> | undefined) },
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('token 无效或已过期：请从浏览器（dida365.com 的 Cookie）重新复制 t 的值');
  }
  if (!response.ok) {
    throw new Error(`滴答清单接口请求失败（HTTP ${response.status}）：${url}`);
  }
  return response.json();
}

export async function fetchHabits(
  apiBase: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<DidaHabit[]> {
  const data = await fetchDidaJson(`${apiBase}/api/v2/habits`, token, { method: 'GET' }, fetchImpl);
  return Array.isArray(data) ? (data as DidaHabit[]) : [];
}

/** 打卡明细：POST query 为 Web 端现用路由；旧版本服务可回退 GET habitCheckins?startDate&endDate */
export async function fetchCheckinRecords(
  apiBase: string,
  token: string,
  habitIds: string[],
  startDay: string,
  endDay: string,
  fetchImpl: typeof fetch,
): Promise<DidaCheckinRecord[]> {
  const toRecords = (data: unknown): DidaCheckinRecord[] => {
    if (Array.isArray(data)) return data as DidaCheckinRecord[];
    const map = (data as { checkins?: Record<string, unknown> } | null)?.checkins;
    if (map && typeof map === 'object') {
      return Object.entries(map).map(([habitId, checkins]) => ({
        habitId,
        checkins: Array.isArray(checkins) ? (checkins as DidaCheckin[]) : [],
      }));
    }
    return [];
  };
  try {
    const data = await fetchDidaJson(
      `${apiBase}/api/v2/habitCheckins/query`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitIds }),
      },
      fetchImpl,
    );
    return toRecords(data);
  } catch (error) {
    if (!(error instanceof Error) || !/HTTP 4|HTTP 5/.test(error.message)) throw error;
  }
  const data = await fetchDidaJson(
    `${apiBase}/api/v2/habitCheckins?startDate=${startDay}&endDate=${endDay}`,
    token,
    { method: 'GET' },
    fetchImpl,
  );
  return toRecords(data);
}

export async function fetchTaskSnapshot(
  apiBase: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<DidaBatchSnapshot> {
  return (await fetchDidaJson(`${apiBase}/api/v3/batch/check/0`, token, { method: 'GET' }, fetchImpl)) as DidaBatchSnapshot;
}

/**
 * 习惯打卡 → MeLog 条目（按天幂等：dida365-habit-{habitId}-{YYYY-MM-DD}）。
 * 打卡日优先取 checkinStamp（账号本地时区），缺失时回退 checkinTime 的本地日。
 */
export function mapHabitCheckins(
  habits: DidaHabit[],
  records: DidaCheckinRecord[],
  startDay: string,
  endDay: string,
): IngestEntryInput[] {
  const nameById = new Map(habits.map((h) => [h.id, h.name || h.id || '']));
  const entries: IngestEntryInput[] = [];
  for (const record of records) {
    const habitId = record.habitId;
    if (!habitId) continue;
    const name = nameById.get(habitId) || habitId;
    for (const checkin of record.checkins || []) {
      const day = stampToDay(checkin.checkinStamp) ?? (() => {
        const parsed = parseDidaDate(checkin.checkinTime || checkin.opTime);
        return parsed ? dayKey(parsed) : null;
      })();
      if (!day || day < startDay || day > endDay) continue;
      const occurred = parseDidaDate(checkin.checkinTime || checkin.opTime) ?? new Date(`${day}T00:00:00`);
      entries.push({
        externalId: `dida365-habit-${habitId}-${day}`,
        category: 'custom',
        type: 'habit-checkin',
        title: `习惯打卡：${name}`,
        payload: JSON.stringify({
          habitId,
          habitName: name,
          value: checkin.value ?? null,
          goal: checkin.goal ?? null,
          status: checkin.status ?? null,
          checkinTime: checkin.checkinTime ?? null,
        }),
        tags: 'dida365,habit',
        occurredAt: occurred.toISOString(),
      });
    }
  }
  return entries;
}

/** 备注锚点：完成时间 > 截止时间 > 创建时间 */
export function taskAnchorTime(task: DidaTask): string {
  const occurred =
    parseDidaDate(task.completedTime) || parseDidaDate(task.dueDate) || parseDidaDate(task.createdTime) || new Date();
  return occurred.toISOString();
}

/** 带备注的任务 → MeLog 条目（幂等：dida365-task-{taskId}） */
export function mapTaskNotes(tasks: DidaTask[], projectNameById: Map<string, string>): IngestEntryInput[] {
  const entries: IngestEntryInput[] = [];
  for (const task of tasks) {
    const note = (task.content ?? task.desc ?? '').trim();
    if (!task.id || !note) continue;
    const listName = task.projectId ? projectNameById.get(task.projectId) : undefined;
    entries.push({
      externalId: `dida365-task-${task.id}`,
      category: 'note',
      type: 'task-note',
      title: task.title || '未命名任务',
      content: note,
      tags: ['dida365', 'todo', listName].filter(Boolean).join(','),
      occurredAt: taskAnchorTime(task),
    });
  }
  return entries;
}

/** 只拉取与转换，不推送（供 --dry-run 使用） */
export async function collectDida365Entries(options: Dida365ConnectorOptions): Promise<Dida365CollectResult> {
  const apiBase = (options.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const today = options.today ? new Date(options.today) : new Date();
  const endDay = dayKey(today);
  const startDay = dayKey(new Date(today.getTime() - ((options.backfillDays ?? 30) - 1) * DAY_MS));

  let habitEntries: IngestEntryInput[] = [];
  let habits: DidaHabit[] = [];
  if (options.includeHabits !== false) {
    habits = await fetchHabits(apiBase, options.token, fetchImpl);
    const habitIds = habits.map((h) => h.id).filter((id): id is string => !!id);
    const records = await fetchCheckinRecords(apiBase, options.token, habitIds, startDay, endDay, fetchImpl);
    habitEntries = mapHabitCheckins(habits, records, startDay, endDay);
  }

  let taskEntries: IngestEntryInput[] = [];
  if (options.includeTasks !== false) {
    const snapshot = await fetchTaskSnapshot(apiBase, options.token, fetchImpl);
    const projectNameById = new Map<string, string>();
    for (const profile of snapshot.projectProfiles || []) {
      if (profile.id) projectNameById.set(profile.id, profile.name || profile.id);
    }
    if (snapshot.inboxId) projectNameById.set(snapshot.inboxId, INBOX_NAME);
    const tasks = [...(snapshot.syncTaskBean?.update || []), ...(snapshot.syncTaskBean?.add || [])];
    taskEntries = mapTaskNotes(tasks, projectNameById);
  }

  return { habitEntries, taskEntries, habits: habits.length, from: startDay, to: endDay };
}

export async function runDida365Connector(options: Dida365ConnectorOptions): Promise<Dida365SyncResult> {
  if (!options.client) throw new Error('缺少 MeLogIngestClient（dry-run 请使用 collectDida365Entries）');
  const collected = await collectDida365Entries(options);
  const summary = { created: 0, updated: 0, skipped: 0 };

  if (collected.habitEntries.length > 0) {
    const result = await options.client.ingest(
      'dida365',
      options.sourceName || '滴答清单',
      'custom',
      collected.habitEntries,
      options.apiBase || DEFAULT_API_BASE,
    );
    summary.created += result.created;
    summary.updated += result.updated;
    summary.skipped += result.skipped;
  }
  if (collected.taskEntries.length > 0) {
    const result = await options.client.ingest(
      'dida365',
      options.sourceName || '滴答清单',
      'note',
      collected.taskEntries,
      options.apiBase || DEFAULT_API_BASE,
    );
    summary.created += result.created;
    summary.updated += result.updated;
    summary.skipped += result.skipped;
  }

  return {
    ...collected,
    ...summary,
    tasks: collected.taskEntries.length,
  };
}
