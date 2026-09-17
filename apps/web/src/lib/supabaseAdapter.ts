/**
 * Supabase 适配器：实现 LocalDBAdapter 同一接口，把请求翻译成 PostgREST。
 * 与 apps/web/src/lib/api.ts 的 localDBAdapter 并列；在生产构建（Meoo Cloud）里是默认通路。
 *
 * 形状契约以 fastify（packages/api）为基准，三个适配器保持一致：
 *   list          → { <list key>: T[] }      （注意 list/one 的 key 可能不同，见 ENTITIES）
 *   getOne        → { <one key>: T }
 *   create/update → { <one key>: T }
 *   delete        → { success: true }
 * 嵌套关系用 supabase-js 资源嵌入语法：`select('*, notes:topic_notes(*)')`，
 * 子表别名取前端的字段名（camelCase），PostgREST 会按别名返回。
 *
 * 安全边界：所有子资源路由（notes / key-results / quotas / steps 等）只打各自的
 * 子表；未实现的子路径显式抛 501，绝不落到父表的 PATCH/DELETE，
 * 避免「删一条笔记结果删掉整个主题」这类数据损坏。
 */
import { supabase } from '../supabase/client';

// 动态表名绕开 supabase-js 的字面量 union 类型检查；auth 路径仍走 supabase 自身。
const sb = () => supabase as any;

// ==================== 实体映射 ====================

interface EntityMeta {
  /** 云端表名（snake_case），与 schema.cloud.prisma 的 @@map 一致 */
  table: string;
  /** 列表响应 key（对齐 fastify） */
  list: string;
  /** 单条响应 key（对齐 fastify） */
  one: string;
}

const ENTITIES: Record<string, EntityMeta> = {
  domains: { table: 'domains', list: 'domains', one: 'domain' },
  mindsets: { table: 'mindset_slogans', list: 'slogans', one: 'slogan' },
  reflections: { table: 'reflections', list: 'reflections', one: 'reflection' },
  reviews: { table: 'periodic_reviews', list: 'reviews', one: 'review' },
  insights: { table: 'insight_notes', list: 'insights', one: 'insight' },
  subscriptions: { table: 'subscriptions', list: 'subscriptions', one: 'subscription' },
  topics: { table: 'topics', list: 'topics', one: 'topic' },
  todos: { table: 'todos', list: 'todos', one: 'todo' },
  habits: { table: 'habits', list: 'habits', one: 'habit' },
  goals: { table: 'goals', list: 'goals', one: 'goal' },
  visions: { table: 'visions', list: 'visions', one: 'vision' },
  contacts: { table: 'contacts', list: 'contacts', one: 'contact' },
  reading: { table: 'reading_items', list: 'items', one: 'item' },
  health: { table: 'health_records', list: 'records', one: 'record' },
  workflows: { table: 'workflows', list: 'workflows', one: 'workflow' },
};

// list / 单条查询需要嵌入的关系（别名 = 前端字段名）
const EMBED: Record<string, string> = {
  habits: '*, logs:habit_logs(*)',
  topics: '*, notes:topic_notes(*)',
  goals: '*, keyResults:key_results(*)',
  workflows: '*, steps:workflow_steps(*), connections:workflow_connections(*)',
  subscriptions: '*, quotas:quota_definitions(*)',
};

// 列表默认排序（对齐 fastify；未列出的实体用 createdAt desc）
const ORDER: Record<string, { column: string; ascending: boolean }[]> = {
  domains: [{ column: 'order', ascending: true }],
  mindsets: [{ column: 'order', ascending: true }],
  todos: [{ column: 'order', ascending: true }, { column: 'dueDate', ascending: true }],
  habits: [{ column: 'order', ascending: true }],
  goals: [{ column: 'order', ascending: true }, { column: 'updatedAt', ascending: false }],
  topics: [{ column: 'order', ascending: true }, { column: 'updatedAt', ascending: false }],
  reflections: [{ column: 'date', ascending: false }],
  reviews: [{ column: 'startDate', ascending: false }],
  reading: [{ column: 'updatedAt', ascending: false }],
  health: [{ column: 'recordedAt', ascending: false }],
  contacts: [{ column: 'name', ascending: true }],
  workflows: [{ column: 'createdAt', ascending: false }],
  subscriptions: [{ column: 'createdAt', ascending: false }],
};

// 支持 isMock 列的实体（其余品牌的 isMock 列不在本适配器范围内）
const IS_MOCK_ENTITIES = new Set(['topics']);

// 写入时要剔除的嵌入 / 只读字段（曾用于本地或远端响应拼接，直接写回会触发 PostgREST 列不存在）
const WRITE_STRIP_KEYS = new Set([
  'logs', 'keyResults', 'quotas', 'steps', 'connections', 'domain', 'skill',
  'quotaUsages', 'usageRecords', 'currentUsage', 'history', '_count', 'pagination',
]);

function cleanPayload(entity: string, data?: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((data ?? {}) as Record<string, unknown>)) {
    if (k === 'mock') {
      // 旧前端在「认领演示数据」时会 patch { mock: false }；只有真实存在 isMock 列的表才落库
      if (IS_MOCK_ENTITIES.has(entity) && typeof v === 'boolean') out.isMock = v;
      continue;
    }
    if (v === undefined || WRITE_STRIP_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

// ==================== 基础工具 ====================

function err(message: string, status = 400): Error {
  return Object.assign(new Error(message), { response: { data: { error: message } }, status });
}

function parseQuery(queryStr?: string): Record<string, string> {
  const query: Record<string, string> = {};
  if (!queryStr) return query;
  for (const pair of queryStr.split('&')) {
    const [k, v] = pair.split('=');
    if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return query;
}

async function currentUid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw err('请先登录', 401);
  return data.user.id;
}

async function ensureProfile(uid: string, email: string): Promise<void> {
  const { data } = await sb().from('users').select('id').eq('id', uid).maybeSingle();
  if (!data) {
    const now = new Date().toISOString();
    await sb().from('users').insert({
      id: uid,
      email,
      name: email.split('@')[0],
      updatedAt: now,
    });
  }
}

function profileOf(u: { id: string; email?: string | null; created_at?: string }): unknown {
  return {
    id: u.id,
    email: u.email ?? '',
    name: (u.email ?? '').split('@')[0],
    createdAt: u.created_at ?? new Date().toISOString(),
  };
}

// ==================== 时间 / 健康文案工具（与 fastify 保持一致） ====================

function localDayBounds(dateKey?: string): { start: Date; end: Date } {
  const start = dateKey ? new Date(`${dateKey}T00:00:00`) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

const HEALTH_LABELS: Record<string, string> = {
  sleep: '睡眠',
  exercise: '运动',
  weight: '体重',
  mood: '心情',
  energy: '精力',
  water: '饮水',
  custom: '健康',
};

const UNIT_LABELS: Record<string, string> = {
  km: '公里',
  minutes: '分钟',
  hours: '小时',
  kg: '公斤',
  steps: '步',
};

function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}

function formatHealthItem(record: { type: string; value: number; unit: string }): string {
  const label = HEALTH_LABELS[record.type] ?? record.type;
  const unit = UNIT_LABELS[record.unit] ?? record.unit;
  return `${label} ${formatNumber(record.value)} ${unit}`;
}

/** 与 packages/api/src/modules/melog/scheduler.ts 的 computeNextRunAt 保持一致 */
function computeNextRunAt(
  kind: string,
  dailyAt: string | null,
  intervalHours: number | null,
  from: Date,
): string | null {
  if (kind === 'daily' && dailyAt) {
    const [hours, minutes] = dailyAt.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    const next = new Date(from);
    next.setHours(hours, minutes, 0, 0);
    if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }
  if (kind === 'interval' && intervalHours && intervalHours > 0) {
    return new Date(from.getTime() + intervalHours * 3600 * 1000).toISOString();
  }
  return null;
}

// ==================== 通用 CRUD ====================

async function listEntity(entity: string, meta: EntityMeta, query: Record<string, string>) {
  if (entity === 'insights') return listInsights(query);

  let q = sb().from(meta.table).select(EMBED[entity] || '*');

  // fastify 契约：习惯列表只返回启用的（并内嵌当天打卡）
  if (entity === 'habits') q = q.eq('isActive', true);

  // 健康记录列表：type / from / to 过滤（默认近 7 天，from=当天零点，to=当天末刻，对齐 fastify）
  if (entity === 'health') {
    if (query.type) q = q.eq('type', query.type);
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 7 * 86400e3);
    q = q.gte('recordedAt', from.toISOString());
    if (query.to) q = q.lte('recordedAt', endOfDay(query.to).toISOString());
  }

  for (const o of ORDER[entity] ?? [{ column: 'createdAt', ascending: false }]) {
    q = q.order(o.column, { ascending: o.ascending });
  }

  const { data: rows, error } = await q;
  if (error) throw err(error.message);
  return { [meta.list]: rows ?? [] };
}

async function listInsights(query: Record<string, string>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const sortBy = query.sortBy || 'createdAt';
  const ascending = (query.sortOrder || 'desc') === 'asc';

  let q = sb().from('insight_notes').select('*', { count: 'exact' });
  if (query.category) q = q.eq('category', query.category);
  const search = (query.search || '').replace(/[%(),\\]/g, '').trim();
  if (search) q = q.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  q = q.order(sortBy, { ascending }).range((page - 1) * limit, page * limit - 1);

  const { data: rows, error, count } = await q;
  if (error) throw err(error.message);
  const total = count ?? 0;
  return {
    insights: rows ?? [],
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getEntity(entity: string, meta: EntityMeta, id: string) {
  const { data: row, error } = await sb()
    .from(meta.table)
    .select(EMBED[entity] || '*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw err(error.message);
  if (!row) throw err('记录不存在', 404);
  return { [meta.one]: row };
}

async function createEntity(entity: string, meta: EntityMeta, data?: unknown) {
  const uid = await currentUid();
  const payload = { ...cleanPayload(entity, data), userId: uid };
  const { data: row, error } = await sb().from(meta.table).insert(payload).select().single();
  if (error) throw err(error.message);
  return { [meta.one]: row };
}

async function updateEntity(entity: string, meta: EntityMeta, id: string, data?: unknown) {
  const payload = cleanPayload(entity, data);
  // 空更新（例如 { mock: false }）按 fastify 的 no-op 语义处理，回读当前行即可
  if (Object.keys(payload).length === 0) return getEntity(entity, meta, id);
  const { data: row, error } = await sb().from(meta.table).update(payload).eq('id', id).select().single();
  if (error) throw err(error.message);
  return { [meta.one]: row };
}

async function deleteEntity(meta: EntityMeta, id: string) {
  const { error } = await sb().from(meta.table).delete().eq('id', id);
  if (error) throw err(error.message);
  return { success: true };
}

// ==================== 专项实体 ====================

// ---------- 平衡轮 ----------

async function handleBalanceWheel(
  method: string,
  segs: string[],
  data: unknown,
  query: Record<string, string>,
) {
  const seg = segs[1];

  if (method === 'POST' && (!seg || seg === 'scores')) {
    const body = (data ?? {}) as { scores?: { domainId: string; score: number; note?: string }[] };
    const scores = body.scores ?? [];
    if (scores.length === 0) return { scores: [] };
    const uid = await currentUid();
    const rows = scores.map((s) => ({
      userId: uid,
      domainId: s.domainId,
      score: s.score,
      note: s.note ?? null,
    }));
    const { data: inserted, error } = await sb().from('balance_wheel_scores').insert(rows).select();
    if (error) throw err(error.message);
    return { scores: inserted ?? [] };
  }

  if (method === 'GET' && seg === 'history') {
    const limit = Math.min(Math.max(parseInt(query.limit || '10', 10) || 10, 1), 100);
    const { data: rows, error } = await sb()
      .from('balance_wheel_scores')
      .select('*, domain:domains(id,name,icon)')
      .order('createdAt', { ascending: false })
      .limit(limit);
    if (error) throw err(error.message);
    return { scores: rows ?? [] };
  }

  if (seg === 'scores' && segs[2]) {
    const scoreId = segs[2];
    if (method === 'GET') {
      const { data: row, error } = await sb()
        .from('balance_wheel_scores')
        .select('*, domain:domains(id,name,icon)')
        .eq('id', scoreId)
        .maybeSingle();
      if (error) throw err(error.message);
      if (!row) throw err('评分记录不存在', 404);
      return { score: row };
    }
    if (method === 'PATCH') {
      const payload = cleanPayload('balance-wheel', data);
      const { data: row, error } = await sb()
        .from('balance_wheel_scores')
        .update(payload)
        .eq('id', scoreId)
        .select('*, domain:domains(id,name,icon)')
        .single();
      if (error) throw err(error.message);
      return { score: row };
    }
    if (method === 'DELETE') {
      const { error } = await sb().from('balance_wheel_scores').delete().eq('id', scoreId);
      if (error) throw err(error.message);
      return { success: true };
    }
  }

  throw err(`暂未支持的 balance-wheel 路由：${method} /${segs.join('/')}`, 501);
}

// ---------- 愿景 ----------

async function handleVisions(method: string, segs: string[], data: unknown) {
  const seg = segs[1];

  // GET /visions → 当前生效的愿景（单条，可为 null）
  if (method === 'GET' && !seg) {
    const { data: rows, error } = await sb()
      .from('visions')
      .select('*')
      .eq('isActive', true)
      .order('version', { ascending: false })
      .limit(1);
    if (error) throw err(error.message);
    return { vision: rows?.[0] ?? null };
  }

  if (method === 'GET' && seg === 'history') {
    const { data: rows, error } = await sb()
      .from('visions')
      .select('*')
      .order('version', { ascending: false });
    if (error) throw err(error.message);
    return { visions: rows ?? [] };
  }

  // POST /visions → 下线旧版本并创建 version+1 的新愿景
  if (method === 'POST' && !seg) {
    const uid = await currentUid();
    const content = (data as { content?: string } | undefined)?.content ?? '';
    const { data: latest, error: latestErr } = await sb()
      .from('visions')
      .select('version')
      .order('version', { ascending: false })
      .limit(1);
    if (latestErr) throw err(latestErr.message);
    const { error: deactivateErr } = await sb()
      .from('visions')
      .update({ isActive: false })
      .eq('isActive', true);
    if (deactivateErr) throw err(deactivateErr.message);
    const version = ((latest?.[0]?.version as number | undefined) ?? 0) + 1;
    const { data: row, error } = await sb()
      .from('visions')
      .insert({ userId: uid, content, version, isActive: true })
      .select()
      .single();
    if (error) throw err(error.message);
    return { vision: row };
  }

  if (method === 'PATCH' && seg) {
    const payload = cleanPayload('visions', data);
    if (payload.isActive === true) {
      const { error } = await sb().from('visions').update({ isActive: false }).eq('isActive', true);
      if (error) throw err(error.message);
    }
    if (Object.keys(payload).length === 0) {
      const { data: row, error } = await sb().from('visions').select('*').eq('id', seg).maybeSingle();
      if (error) throw err(error.message);
      if (!row) throw err('愿景不存在', 404);
      return { vision: row };
    }
    const { data: row, error } = await sb().from('visions').update(payload).eq('id', seg).select().single();
    if (error) throw err(error.message);
    return { vision: row };
  }

  throw err(`暂未支持的 visions 路由：${method} /${segs.join('/')}`, 501);
}

// ---------- 反思聚合 / 订阅 ----------

async function getTodaySummary(dateKey?: string) {
  const { start, end } = localDayBounds(dateKey);
  const uid = await currentUid();
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [todosDoneRes, todosCreatedRes, habitLogsRes, healthRes] = await Promise.all([
    sb()
      .from('todos')
      .select('*')
      .eq('userId', uid)
      .gte('completedAt', startIso)
      .lt('completedAt', endIso)
      .order('completedAt', { ascending: true })
      .limit(20),
    sb()
      .from('todos')
      .select('id', { count: 'exact', head: true })
      .eq('userId', uid)
      .gte('createdAt', startIso)
      .lt('createdAt', endIso),
    sb()
      .from('habit_logs')
      .select('*, habit:habits(title)')
      .eq('userId', uid)
      .gte('date', startIso)
      .lt('date', endIso)
      .order('date', { ascending: true }),
    sb()
      .from('health_records')
      .select('*')
      .eq('userId', uid)
      .gte('recordedAt', startIso)
      .lt('recordedAt', endIso)
      .order('recordedAt', { ascending: true }),
  ]);

  const firstErr = todosDoneRes.error || habitLogsRes.error || healthRes.error;
  if (firstErr) throw err(firstErr.message);

  const todosDone = (todosDoneRes.data ?? []) as { title: string }[];
  const todosCreated = (todosCreatedRes.count as number | null) ?? 0;
  const habitLogs = (habitLogsRes.data ?? []) as { habit?: { title?: string } }[];
  const healthRecords = (healthRes.data ?? []) as { type: string; value: number; unit: string }[];

  const lines: string[] = [];
  if (todosDone.length > 0) {
    lines.push(`待办完成 ${todosDone.length} 条${todosCreated > 0 ? `（今日新增 ${todosCreated} 条）` : ''}`);
  }
  if (habitLogs.length > 0) {
    lines.push(`习惯打卡 ${habitLogs.length} 项（${habitLogs.map((l) => l.habit?.title ?? '').join('、')}）`);
  }
  if (healthRecords.length > 0) {
    lines.push(`健康记录 ${healthRecords.length} 条（${healthRecords.map(formatHealthItem).join('、')}）`);
  }

  return {
    date: localDateKey(start),
    todos: { total: todosDone.length, createdToday: todosCreated, items: todosDone.map((t) => t.title) },
    habits: { total: habitLogs.length, items: habitLogs.map((l) => l.habit?.title ?? '') },
    health: {
      total: healthRecords.length,
      items: healthRecords.map((r) => ({ type: r.type, value: r.value, unit: r.unit, label: formatHealthItem(r) })),
    },
    summary: lines.join('；'),
  };
}

async function getHealthSummary(query: Record<string, string>) {
  const days = Math.max(1, parseInt(query.days || '7', 10) || 7);
  const since = new Date(Date.now() - days * 86400e3).toISOString();
  const { data: rows, error } = await sb()
    .from('health_records')
    .select('type,value,recordedAt')
    .gte('recordedAt', since)
    .order('recordedAt', { ascending: false });
  if (error) throw err(error.message);

  const records = (rows ?? []) as { type: string; value: number }[];
  const grouped: Record<string, number[]> = {};
  for (const r of records) {
    (grouped[r.type] ??= []).push(r.value);
  }
  const summary: Record<string, { avg: number; count: number; latest: number | null }> = {};
  for (const [type, values] of Object.entries(grouped)) {
    const sum = values.reduce((a, b) => a + b, 0);
    const latestRecord = records.find((r) => r.type === type);
    summary[type] = {
      avg: Number((sum / values.length).toFixed(2)),
      count: values.length,
      latest: latestRecord ? latestRecord.value : null,
    };
  }
  return { summary };
}

async function getSubscriptionDetail(id: string) {
  const { data: sub, error } = await sb()
    .from('subscriptions')
    .select('*, quotas:quota_definitions(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw err(error.message);
  if (!sub) throw err('订阅不存在', 404);

  const now = new Date();
  const { data: usage, error: usageErr } = await sb()
    .from('monthly_usages')
    .select('*, quotaUsages:quota_usages(*)')
    .eq('subscriptionId', id)
    .eq('year', now.getFullYear())
    .eq('month', now.getMonth() + 1)
    .maybeSingle();
  if (usageErr) throw err(usageErr.message);
  return { subscription: sub, currentUsage: usage ?? null };
}

async function getSubscriptionDashboard() {
  const { data: subs, error } = await sb()
    .from('subscriptions')
    .select('*, quotas:quota_definitions(*)')
    .eq('isActive', true);
  if (error) throw err(error.message);

  const now = new Date();
  const rows = (subs ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const ids = rows.map((s) => s.id);

  let usages: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (ids.length > 0) {
    const { data, error: usageErr } = await sb()
      .from('monthly_usages')
      .select('*, quotaUsages:quota_usages(*)')
      .in('subscriptionId', ids)
      .eq('year', now.getFullYear())
      .eq('month', now.getMonth() + 1);
    if (usageErr) throw err(usageErr.message);
    usages = data ?? [];
  }
  const usageMap = new Map<string, any>(usages.map((u) => [u.subscriptionId, u])); // eslint-disable-line @typescript-eslint/no-explicit-any

  const summary = rows.map((sub) => {
    const currentUsage = usageMap.get(sub.id);
    let monthlyCost = sub.costPerCycle;
    if (sub.billingCycle === 'yearly') monthlyCost = sub.costPerCycle / 12;
    else if (sub.billingCycle === 'quarterly') monthlyCost = sub.costPerCycle / 3;

    const quotaUtilization = (sub.quotas ?? []).map((quota: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const usage = currentUsage?.quotaUsages?.find((u: any) => u.quotaDefinitionId === quota.id); // eslint-disable-line @typescript-eslint/no-explicit-any
      const used = usage?.usedAmount || 0;
      const util = quota.monthlyLimit > 0 ? used / quota.monthlyLimit : 0;
      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (util >= quota.criticalThreshold) status = 'critical';
      else if (util >= quota.warningThreshold) status = 'warning';
      return {
        id: quota.id,
        name: quota.name,
        unit: quota.unit,
        used,
        limit: quota.monthlyLimit,
        utilization: util,
        status,
      };
    });

    const overallUtilization = quotaUtilization.length > 0
      ? quotaUtilization.reduce((sum: number, u: any) => sum + u.utilization, 0) / quotaUtilization.length // eslint-disable-line @typescript-eslint/no-explicit-any
      : 0;

    const startDate = new Date(sub.startDate);
    let daysUntilRenewal = 30;
    if (sub.billingCycle === 'yearly') {
      daysUntilRenewal = Math.max(0, 365 - Math.floor((now.getTime() - startDate.getTime()) / 86400e3) % 365);
    } else if (sub.billingCycle === 'quarterly') {
      daysUntilRenewal = Math.max(0, 90 - Math.floor((now.getTime() - startDate.getTime()) / 86400e3) % 90);
    }

    return {
      id: sub.id,
      name: sub.name,
      provider: sub.provider,
      monthlyCost,
      currency: sub.currency,
      overallUtilization,
      quotaUtilization,
      daysUntilRenewal,
      isActive: sub.isActive,
      autoRenew: sub.autoRenew,
    };
  });

  type QuotaUtil = { status: string };
  const totalMonthlySpend = summary.reduce((sum, s) => sum + s.monthlyCost, 0);
  const nearLimitCount = summary.filter((s) => (s.quotaUtilization as QuotaUtil[]).some((q) => q.status === 'warning' || q.status === 'critical')).length;
  const criticalCount = summary.filter((s) => (s.quotaUtilization as QuotaUtil[]).some((q) => q.status === 'critical')).length;

  return {
    subscriptions: summary,
    stats: { totalMonthlySpend, activeCount: summary.length, nearLimitCount, criticalCount },
  };
}

// ---------- MeLog ----------

const MELOG_CATEGORIES = ['health', 'note', 'im', 'media', 'location', 'custom'] as const;

async function melogOverview() {
  const now = Date.now();
  const d7 = new Date(now - 7 * 86400e3).toISOString();
  const d30 = new Date(now - 30 * 86400e3).toISOString();

  const countEntries = async (decorate?: (q: any) => any): Promise<number> => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let q = sb().from('melog_entries').select('id', { count: 'exact', head: true });
    if (decorate) q = decorate(q);
    const { count, error } = await q;
    if (error) throw err(error.message);
    return count ?? 0;
  };

  const counts = await Promise.all([
    countEntries(),
    countEntries((q) => q.gte('occurredAt', d7)),
    countEntries((q) => q.gte('occurredAt', d30)),
    ...MELOG_CATEGORIES.flatMap((cat) => [
      countEntries((q) => q.eq('category', cat)),
      countEntries((q) => q.eq('category', cat).gte('occurredAt', d7)),
    ]),
  ]);

  const [totalEntries, last7Days, last30Days] = counts;
  const byCategory = MELOG_CATEGORIES.map((category, i) => ({
    category,
    count: counts[3 + i * 2],
    last7Days: counts[3 + i * 2 + 1],
  }));

  const [sourcesRes, runsRes] = await Promise.all([
    sb().from('melog_sources').select('status').order('updatedAt', { ascending: false }),
    sb().from('melog_runs').select('*, skill:melog_skills(name,slug)').order('createdAt', { ascending: false }).limit(5),
  ]);
  if (sourcesRes.error) throw err(sourcesRes.error.message);
  if (runsRes.error) throw err(runsRes.error.message);

  const sources = (sourcesRes.data ?? []) as { status: string }[];
  return {
    totalEntries,
    last7Days,
    last30Days,
    byCategory,
    sources: [{
      total: sources.length,
      connected: sources.filter((s) => s.status === 'connected').length,
      error: sources.filter((s) => s.status === 'error').length,
    }],
    latestRuns: runsRes.data ?? [],
    // 云端 LLM 运行依赖 Meoo Edge Function；PostgREST 直连模式下前端就绪状态为未配置
    llm: { configured: false, model: null },
  };
}

async function melogEntries(query: Record<string, string>) {
  const limit = Math.min(Math.max(parseInt(query.limit || '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(query.offset || '0', 10) || 0, 0);

  let q = sb()
    .from('melog_entries')
    .select('*, source:melog_sources(name,adapter,category)', { count: 'exact' });
  if (query.category) q = q.eq('category', query.category);
  if (query.sourceId) q = q.eq('sourceId', query.sourceId);
  if (query.from) q = q.gte('occurredAt', new Date(query.from).toISOString());
  if (query.to) q = q.lte('occurredAt', new Date(query.to).toISOString());
  const search = (query.q || '').replace(/[%(),\\]/g, '').trim();
  if (search) q = q.or(`title.ilike.%${search}%,content.ilike.%${search}%,actor.ilike.%${search}%`);
  q = q.order('occurredAt', { ascending: false }).range(offset, offset + limit - 1);

  const { data: rows, error, count } = await q;
  if (error) throw err(error.message);
  return { entries: rows ?? [], total: count ?? 0 };
}

async function handleMelog(
  method: string,
  segs: string[],
  data: unknown,
  query: Record<string, string>,
) {
  const part = segs[1];
  const partId = segs[2];

  if (method === 'GET' && part === 'overview') return melogOverview();

  if (part === 'entries') {
    if (method === 'GET' && !partId) return melogEntries(query);
    if (method === 'GET' && partId) {
      const { data: row, error } = await sb()
        .from('melog_entries')
        .select('*, source:melog_sources(name,adapter,category)')
        .eq('id', partId)
        .maybeSingle();
      if (error) throw err(error.message);
      if (!row) throw err('条目不存在', 404);
      return { entry: row };
    }
    if (method === 'DELETE' && partId) {
      const { error } = await sb().from('melog_entries').delete().eq('id', partId);
      if (error) throw err(error.message);
      return { success: true };
    }
  }

  if (part === 'sources') {
    if (method === 'GET') {
      const { data: rows, error } = await sb()
        .from('melog_sources')
        .select('*')
        .order('updatedAt', { ascending: false });
      if (error) throw err(error.message);
      return { sources: rows ?? [] };
    }
    if (method === 'POST' && !partId) {
      const uid = await currentUid();
      const { data: row, error } = await sb()
        .from('melog_sources')
        .insert({ ...cleanPayload('melogSources', data), status: 'disconnected', userId: uid })
        .select()
        .single();
      if (error) throw err(error.message);
      return { source: row };
    }
    if (method === 'PATCH' && partId) {
      const { data: row, error } = await sb()
        .from('melog_sources')
        .update(cleanPayload('melogSources', data))
        .eq('id', partId)
        .select()
        .single();
      if (error) throw err(error.message);
      return { source: row };
    }
    if (method === 'DELETE' && partId) {
      const { error } = await sb().from('melog_sources').delete().eq('id', partId);
      if (error) throw err(error.message);
      return { success: true };
    }
  }

  if (part === 'skills') {
    if (method === 'GET') {
      const { data: rows, error } = await sb()
        .from('melog_skills')
        .select('*')
        .order('source', { ascending: true })
        .order('createdAt', { ascending: true });
      if (error) throw err(error.message);
      return { skills: rows ?? [] };
    }
    if (method === 'POST' && partId && segs[3] === 'run') {
      // 技能执行依赖服务端（LLM / 规则引擎），由 Meoo Edge Function 提供
      throw err('技能运行依赖 Meoo Edge Function（待部署），云端暂不可用', 501);
    }
    if (method === 'POST' && !partId) {
      const uid = await currentUid();
      const body = cleanPayload('melogSkills', data) as { slug?: string; source?: string };
      const { data: existing, error: checkErr } = await sb()
        .from('melog_skills')
        .select('id')
        .eq('slug', body.slug ?? '')
        .maybeSingle();
      if (checkErr) throw err(checkErr.message);
      if (existing) throw err('同名技能已安装', 409);
      const { data: row, error } = await sb()
        .from('melog_skills')
        .insert({ ...body, userId: uid, source: body.source ?? 'custom' })
        .select()
        .single();
      if (error) throw err(error.message);
      return { skill: row };
    }
    if (method === 'PATCH' && partId) {
      const { data: row, error } = await sb()
        .from('melog_skills')
        .update(cleanPayload('melogSkills', data))
        .eq('id', partId)
        .select()
        .single();
      if (error) throw err(error.message);
      return { skill: row };
    }
    if (method === 'DELETE' && partId) {
      const { data: row, error } = await sb().from('melog_skills').select('source').eq('id', partId).maybeSingle();
      if (error) throw err(error.message);
      if (!row) throw err('技能不存在', 404);
      if (row.source === 'builtin') throw err('内置技能不可卸载', 400);
      const { error: delErr } = await sb().from('melog_skills').delete().eq('id', partId);
      if (delErr) throw err(delErr.message);
      return { success: true };
    }
  }

  if (part === 'runs') {
    if (method === 'GET' && !partId) {
      let q = sb().from('melog_runs').select('*, skill:melog_skills(name,slug)');
      if (query.skillId) q = q.eq('skillId', query.skillId);
      q = q.order('createdAt', { ascending: false }).limit(50);
      const { data: rows, error } = await q;
      if (error) throw err(error.message);
      return { runs: rows ?? [] };
    }
    if (method === 'GET' && partId) {
      const { data: row, error } = await sb()
        .from('melog_runs')
        .select('*, skill:melog_skills(name,slug)')
        .eq('id', partId)
        .maybeSingle();
      if (error) throw err(error.message);
      if (!row) throw err('运行记录不存在', 404);
      return { run: row };
    }
  }

  if (part === 'schedules') {
    if (method === 'GET') {
      const { data: rows, error } = await sb()
        .from('melog_schedules')
        .select('*, skill:melog_skills(name,slug)')
        .order('createdAt', { ascending: true });
      if (error) throw err(error.message);
      return { schedules: rows ?? [] };
    }
    if (method === 'POST') {
      const body = (data ?? {}) as {
        skillId?: string;
        kind?: string;
        dailyAt?: string;
        intervalHours?: number;
        enabled?: boolean;
      };
      if (!body.skillId) throw err('缺少 skillId 参数');
      const uid = await currentUid();
      const nextRunAt = body.enabled === false
        ? null
        : computeNextRunAt(body.kind ?? 'daily', body.dailyAt ?? null, body.intervalHours ?? null, new Date());
      const { data: row, error } = await sb()
        .from('melog_schedules')
        .upsert(
          {
            userId: uid,
            skillId: body.skillId,
            kind: body.kind ?? 'daily',
            dailyAt: body.dailyAt ?? null,
            intervalHours: body.intervalHours ?? null,
            enabled: body.enabled ?? true,
            nextRunAt,
          },
          { onConflict: 'userId,skillId' },
        )
        .select()
        .single();
      if (error) throw err(error.message);
      return { schedule: row };
    }
    if (method === 'DELETE' && partId) {
      const { error } = await sb().from('melog_schedules').delete().eq('id', partId);
      if (error) throw err(error.message);
      return { success: true };
    }
  }

  if (part === 'capture' || part === 'ingest' || part === 'mcp') {
    throw err('口述打卡 / 数据摄入 / MCP 依赖 Meoo Edge Function（待部署），云端暂不可用', 501);
  }

  throw err(`暂未支持的 melog 路由：${method} /${segs.join('/')}`, 501);
}

// ---------- 子资源路由（严禁落到父表） ----------

async function toggleHabitLog(habitId: string, data?: unknown) {
  const body = (data ?? {}) as { date?: string; note?: string };
  if (!body.date) throw err('缺少 date 参数');
  // 与 fastify 一致：以 UTC 日切分（date 字符串解析为 UTC 零点）
  const dateObj = new Date(body.date);
  const dayStart = new Date(dateObj.toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const dayEnd = new Date(dateObj.toISOString().slice(0, 10) + 'T23:59:59.999Z');

  const { data: existing, error } = await sb()
    .from('habit_logs')
    .select('*')
    .eq('habitId', habitId)
    .gte('date', dayStart.toISOString())
    .lte('date', dayEnd.toISOString())
    .maybeSingle();
  if (error) throw err(error.message);

  if (existing) {
    const { error: delErr } = await sb().from('habit_logs').delete().eq('id', existing.id);
    if (delErr) throw err(delErr.message);
    return { logged: false, log: null };
  }

  const uid = await currentUid();
  const { data: row, error: insErr } = await sb()
    .from('habit_logs')
    .insert({ habitId, userId: uid, date: dateObj.toISOString(), note: body.note ?? null })
    .select()
    .single();
  if (insErr) throw err(insErr.message);
  return { logged: true, log: row };
}

async function recordUsage(subscriptionId: string, year: number, month: number, data?: unknown) {
  const uid = await currentUid();
  const body = (data ?? {}) as {
    notes?: string;
    quotaUsages?: { quotaDefinitionId: string; usedAmount: number }[];
  };

  const { data: usageRow, error } = await sb()
    .from('monthly_usages')
    .upsert(
      { userId: uid, subscriptionId, year, month, notes: body.notes ?? null },
      { onConflict: 'subscriptionId,year,month' },
    )
    .select()
    .single();
  if (error) throw err(error.message);

  for (const item of body.quotaUsages ?? []) {
    const { error: quErr } = await sb()
      .from('quota_usages')
      .upsert(
        {
          userId: uid,
          monthlyUsageId: usageRow.id,
          quotaDefinitionId: item.quotaDefinitionId,
          usedAmount: item.usedAmount,
        },
        { onConflict: 'monthlyUsageId,quotaDefinitionId' },
      );
    if (quErr) throw err(quErr.message);
  }

  const { data: full, error: readErr } = await sb()
    .from('monthly_usages')
    .select('*, quotaUsages:quota_usages(*)')
    .eq('id', usageRow.id)
    .single();
  if (readErr) throw err(readErr.message);
  return { monthlyUsage: full };
}

async function handleSubresource(
  entity: string,
  method: string,
  id: string,
  segs: string[],
  data: unknown,
  query: Record<string, string>,
) {
  const sub = segs[2];
  const subId = segs[3];

  // 习惯打卡 / 打卡记录
  if (entity === 'habits' && sub === 'log' && method === 'POST') {
    return toggleHabitLog(id, data);
  }
  if (entity === 'habits' && sub === 'logs' && method === 'GET') {
    let q = sb().from('habit_logs').select('*').eq('habitId', id);
    if (query.from) q = q.gte('date', new Date(query.from).toISOString());
    if (query.to) q = q.lte('date', endOfDay(query.to).toISOString());
    q = q.order('date', { ascending: false });
    const { data: rows, error } = await q;
    if (error) throw err(error.message);
    return { logs: rows ?? [] };
  }

  // 主题笔记：只打 topic_notes 表
  if (entity === 'topics' && sub === 'notes') {
    if (method === 'POST' && !subId) {
      const uid = await currentUid();
      const body = (data ?? {}) as { content?: string; noteType?: string };
      const { data: row, error } = await sb()
        .from('topic_notes')
        .insert({
          topicId: id,
          userId: uid,
          content: body.content ?? '',
          noteType: body.noteType ?? 'reflection',
        })
        .select()
        .single();
      if (error) throw err(error.message);
      return { note: row };
    }
    if (method === 'DELETE' && subId) {
      const { error } = await sb().from('topic_notes').delete().eq('id', subId).eq('topicId', id);
      if (error) throw err(error.message);
      return { success: true };
    }
  }

  // 联系人「最近联系」
  if (entity === 'contacts' && sub === 'touch' && method === 'POST') {
    const { data: row, error } = await sb()
      .from('contacts')
      .update({ lastContact: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw err(error.message);
    return { contact: row };
  }

  // 目标关键结果：只打 key_results 表
  if (entity === 'goals' && sub === 'key-results') {
    if (method === 'POST' && !subId) {
      const uid = await currentUid();
      const { data: row, error } = await sb()
        .from('key_results')
        .insert({ ...cleanPayload('keyResults', data), goalId: id, userId: uid })
        .select()
        .single();
      if (error) throw err(error.message);
      return { keyResult: row };
    }
    if (method === 'PATCH' && subId) {
      const { data: row, error } = await sb()
        .from('key_results')
        .update(cleanPayload('keyResults', data))
        .eq('id', subId)
        .eq('goalId', id)
        .select()
        .single();
      if (error) throw err(error.message);
      return { keyResult: row };
    }
    if (method === 'DELETE' && subId) {
      const { error } = await sb().from('key_results').delete().eq('id', subId).eq('goalId', id);
      if (error) throw err(error.message);
      return { success: true };
    }
  }

  // 订阅配额：只打 quota_definitions 表
  if (entity === 'subscriptions' && sub === 'quotas') {
    if (method === 'POST' && !subId) {
      const uid = await currentUid();
      const { data: row, error } = await sb()
        .from('quota_definitions')
        .insert({ ...cleanPayload('quotas', data), subscriptionId: id, userId: uid })
        .select()
        .single();
      if (error) throw err(error.message);
      return { quota: row };
    }
    if (method === 'PATCH' && subId) {
      const { data: row, error } = await sb()
        .from('quota_definitions')
        .update(cleanPayload('quotas', data))
        .eq('id', subId)
        .eq('subscriptionId', id)
        .select()
        .single();
      if (error) throw err(error.message);
      return { quota: row };
    }
    if (method === 'DELETE' && subId) {
      const { error } = await sb().from('quota_definitions').delete().eq('id', subId).eq('subscriptionId', id);
      if (error) throw err(error.message);
      return { success: true };
    }
  }

  // 用量记录：POST /subscriptions/:id/usage/:year/:month
  if (entity === 'subscriptions' && sub === 'usage' && method === 'POST') {
    const year = parseInt(segs[3] ?? '', 10);
    const month = parseInt(segs[4] ?? '', 10);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return recordUsage(id, year, month, data);
    }
  }

  // 工作流节点 / 连线：只打 workflow_steps / workflow_connections 表
  if (entity === 'workflows' && (sub === 'steps' || sub === 'connections')) {
    const table = sub === 'steps' ? 'workflow_steps' : 'workflow_connections';
    const oneKey = sub === 'steps' ? 'step' : 'connection';
    if (method === 'POST' && !subId) {
      const uid = await currentUid();
      const { data: row, error } = await sb()
        .from(table)
        .insert({ ...cleanPayload(entity, data), workflowId: id, userId: uid })
        .select()
        .single();
      if (error) throw err(error.message);
      return { [oneKey]: row };
    }
    if (method === 'PATCH' && subId) {
      const { data: row, error } = await sb()
        .from(table)
        .update(cleanPayload(entity, data))
        .eq('id', subId)
        .eq('workflowId', id)
        .select()
        .single();
      if (error) throw err(error.message);
      return { [oneKey]: row };
    }
    if (method === 'DELETE' && subId) {
      const { error } = await sb().from(table).delete().eq('id', subId).eq('workflowId', id);
      if (error) throw err(error.message);
      return { success: true };
    }
  }

  throw err(`暂未支持的子资源路由：${method} /${segs.join('/')}`, 501);
}

// ==================== 适配器入口 ====================

interface Adapter {
  get: (url: string) => Promise<{ data: unknown }>;
  post: (url: string, data?: unknown) => Promise<{ data: unknown }>;
  patch: (url: string, data?: unknown) => Promise<{ data: unknown }>;
  delete: (url: string) => Promise<{ data: unknown }>;
  request: (url: string, method?: 'GET' | 'POST' | 'PATCH' | 'DELETE', data?: unknown) => Promise<unknown>;
  handleAuth: (segments: string[], data?: unknown) => Promise<unknown>;
}

export const supabaseAdapter: Adapter = {
  async get(url: string) {
    return { data: await this.request(url, 'GET') };
  },
  async post(url: string, data?: unknown) {
    return { data: await this.request(url, 'POST', data) };
  },
  async patch(url: string, data?: unknown) {
    return { data: await this.request(url, 'PATCH', data) };
  },
  async delete(url: string) {
    return { data: await this.request(url, 'DELETE') };
  },

  async request(url, method = 'GET', data?) {
    const [path, queryStr] = url.split('?');
    const segs = path.split('/').filter(Boolean);
    const entity = segs[0];
    const id = segs[1];
    const query = parseQuery(queryStr);

    if (path.startsWith('/auth/')) return this.handleAuth(segs, data);

    if (entity === 'balance-wheel') return handleBalanceWheel(method, segs, data, query);
    if (entity === 'visions') return handleVisions(method, segs, data);
    if (entity === 'melog') return handleMelog(method, segs, data, query);

    const meta = ENTITIES[entity];
    if (!meta) throw err(`未配置到 supabase 的实体：${entity}`, 501);

    // 子资源 / 复合路由先行，防止误打到父表
    if (id) {
      if (entity === 'health' && id === 'summary' && method === 'GET') {
        return getHealthSummary(query);
      }
      if (entity === 'reflections' && id === 'today-summary' && method === 'GET') {
        return getTodaySummary(query.date);
      }
      if (entity === 'subscriptions' && id === 'dashboard' && segs[2] === 'summary' && method === 'GET') {
        return getSubscriptionDashboard();
      }
      if (segs[2]) {
        return handleSubresource(entity, method, id, segs, data, query);
      }
    }

    // 通用 CRUD：仅处理 /entity 与 /entity/:id 两级
    if (method === 'GET' && !id) return listEntity(entity, meta, query);
    if (entity === 'subscriptions' && method === 'GET' && id) return getSubscriptionDetail(id);
    if (method === 'GET' && id) return getEntity(entity, meta, id);
    if (method === 'POST' && !id) return createEntity(entity, meta, data);
    if (method === 'PATCH' && id) return updateEntity(entity, meta, id, data);
    if (method === 'DELETE' && id) return deleteEntity(meta, id);

    throw err(`未实现的 supabase 适配器路由：${method} ${url}`, 501);
  },

  async handleAuth(segs, data) {
    const action = segs[1];
    const d = (data ?? {}) as Record<string, string>;
    if (action === 'login') {
      const { data: r, error } = await supabase.auth.signInWithPassword({
        email: d.email,
        password: d.password,
      });
      if (error || !r.user) throw err(error?.message ?? '登录失败', 401);
      await ensureProfile(r.user.id, d.email);
      return { user: profileOf(r.user) };
    }
    if (action === 'register') {
      // Meoo 默认关闭公开注册，由平台/运维通过 admin 接口建账号；
      // 这里前端 register 路径仅做"已有账号后首次登录"。
      throw err('请通过 meoo cloud admin 创建账号，再回到登录页。', 403);
    }
    if (action === 'me') {
      const { data: r } = await supabase.auth.getUser();
      if (!r.user) throw err('Not authenticated', 401);
      return { user: profileOf(r.user) };
    }
    throw err(`未知 auth 动作：${action}`, 404);
  },
};
