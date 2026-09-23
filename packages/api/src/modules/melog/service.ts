import { prisma } from '../../lib/prisma.js';
import { ensureBuiltinSkills, getBuiltinSkill, type BuiltinSkillDef } from './skills.js';
import { gatherContextData, generateLlmReport, getLlmProvider, isLlmConfigured } from './llm.js';

/**
 * MeLog 服务层：条目写入（ingest）、总览统计、技能执行与调度。
 *
 * ingest 是 MeLog Standard 的核心入口：连接器（chatlog、Apple Health 导出、
 * Obsidian 同步等）按统一信封批量推送条目，以 (sourceId, externalId) 幂等去重。
 */

export const MELOG_CATEGORIES = ['health', 'note', 'im', 'media', 'location', 'custom'] as const;
export type MeLogCategoryValue = (typeof MELOG_CATEGORIES)[number];

export interface IngestEntryInput {
  externalId?: string;
  category: string;
  type: string;
  title: string;
  content?: string;
  payload?: string;
  tags?: string;
  actor?: string;
  occurredAt: string | Date;
}

export interface IngestInput {
  sourceId?: string;
  source?: { adapter: string; name: string; category?: string; endpoint?: string; config?: string };
  entries: IngestEntryInput[];
}

export interface IngestResult {
  sourceId: string;
  created: number;
  updated: number;
  skipped: number;
}

const MAX_BATCH_SIZE = 500;

export async function resolveSource(
  userId: string,
  input: IngestInput,
): Promise<{ id: string }> {
  if (input.sourceId) {
    const source = await prisma.meLogSource.findFirst({ where: { id: input.sourceId, userId } });
    if (!source) throw new Error('数据源不存在');
    return { id: source.id };
  }

  if (!input.source?.adapter || !input.source?.name) {
    throw new Error('必须提供 sourceId 或 source.adapter + source.name');
  }

  const category = input.source.category || 'custom';
  const source = await prisma.meLogSource.upsert({
    where: {
      userId_adapter_name: {
        userId,
        adapter: input.source.adapter,
        name: input.source.name,
      },
    },
    update: { status: 'connected', isActive: true },
    create: {
      userId,
      adapter: input.source.adapter,
      name: input.source.name,
      category,
      endpoint: input.source.endpoint,
      config: input.source.config,
      status: 'connected',
    },
  });
  return { id: source.id };
}

export async function ingestEntries(userId: string, input: IngestInput): Promise<IngestResult> {
  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    throw new Error('entries 不能为空');
  }
  if (input.entries.length > MAX_BATCH_SIZE) {
    throw new Error(`单次最多写入 ${MAX_BATCH_SIZE} 条`);
  }

  const source = await resolveSource(userId, input);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of input.entries) {
    const occurredAt = new Date(raw.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      skipped += 1;
      continue;
    }

    const data = {
      category: raw.category,
      type: raw.type,
      title: raw.title,
      content: raw.content,
      payload: raw.payload,
      tags: raw.tags,
      actor: raw.actor,
      occurredAt,
    };

    if (raw.externalId) {
      const existing = await prisma.meLogEntry.findUnique({
        where: { sourceId_externalId: { sourceId: source.id, externalId: raw.externalId } },
        select: { id: true },
      });
      if (existing) {
        await prisma.meLogEntry.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.meLogEntry.create({ data: { ...data, userId, sourceId: source.id, externalId: raw.externalId } });
        created += 1;
      }
    } else {
      await prisma.meLogEntry.create({ data: { ...data, userId, sourceId: source.id } });
      created += 1;
    }
  }

  const entryCount = await prisma.meLogEntry.count({ where: { sourceId: source.id } });
  await prisma.meLogSource.update({
    where: { id: source.id },
    data: { entryCount, lastSyncAt: new Date(), status: 'connected' },
  });

  return { sourceId: source.id, created, updated, skipped };
}

export async function getOverview(userId: string) {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [totalEntries, last7Days, last30Days, byCategoryRaw, sources, latestRuns] = await Promise.all([
    prisma.meLogEntry.count({ where: { userId } }),
    prisma.meLogEntry.count({ where: { userId, occurredAt: { gte: d7 } } }),
    prisma.meLogEntry.count({ where: { userId, occurredAt: { gte: d30 } } }),
    prisma.meLogEntry.groupBy({
      by: ['category'],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.meLogSource.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
    prisma.meLogRun.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { skill: { select: { name: true, slug: true } } },
    }),
  ]);

  const last7ByCategory = await prisma.meLogEntry.groupBy({
    by: ['category'],
    where: { userId, occurredAt: { gte: d7 } },
    _count: { _all: true },
  });

  const count7 = new Map(last7ByCategory.map((row) => [row.category, row._count._all]));
  const byCategory = MELOG_CATEGORIES.map((category) => ({
    category,
    count: byCategoryRaw.find((row) => row.category === category)?._count._all || 0,
    last7Days: count7.get(category) || 0,
  }));

  const [total, connected, error] = [sources.length, sources.filter((s) => s.status === 'connected').length, sources.filter((s) => s.status === 'error').length];

  return {
    totalEntries,
    last7Days,
    last30Days,
    byCategory,
    sources: [{ total, connected, error }],
    latestRuns,
    llm: { configured: isLlmConfigured(), model: getLlmProvider()?.model },
  };
}

// ==================== 技能执行 ====================

export type SkillEngine = 'auto' | 'rule' | 'llm';

export function getSkillEngine(config: string | null | undefined): SkillEngine {
  if (!config) return 'auto';
  try {
    const parsed = JSON.parse(config) as { engine?: string };
    if (parsed.engine === 'rule' || parsed.engine === 'llm' || parsed.engine === 'auto') {
      return parsed.engine;
    }
  } catch {
    // 非法配置按 auto 处理
  }
  return 'auto';
}

export interface SkillRunResult {
  run: {
    id: string;
    status: string;
    summary?: string | null;
    result?: string | null;
    skill?: { name: string; slug: string };
  } & Record<string, unknown>;
  result: string;
}

async function runBuiltin(
  builtin: BuiltinSkillDef,
  skillRecord: { id: string; config?: string | null },
  userId: string,
  start: Date,
  end: Date,
  notice = '',
): Promise<SkillRunResult> {
  const output = await builtin.run(userId, start, end);
  let run = await prisma.meLogRun.create({
    data: {
      userId,
      skillId: skillRecord.id,
      status: 'succeeded',
      periodStart: start,
      periodEnd: end,
      summary: output.summary,
      result: notice + output.result,
      stats: JSON.stringify({ ...output.stats, engine: 'rule' }),
      entryIds: JSON.stringify(output.entryIds),
    },
    include: { skill: { select: { name: true, slug: true } } },
  });
  const linkedReviewId = await maybeSyncReviewToPeriodicReview(userId, builtin.slug, skillRecord, start, end, run);
  if (linkedReviewId) {
    run = await prisma.meLogRun.update({
      where: { id: run.id },
      data: { stats: withStatsField(run.stats, { linkedReviewId }) },
      include: { skill: { select: { name: true, slug: true } } },
    });
  }
  await prisma.meLogSkill.update({ where: { id: skillRecord.id }, data: { lastRunAt: new Date() } });
  return { run, result: run.result || '' };
}

// ==================== MeLog → 反思（五维）闭环 ====================

function parseSkillConfig(config: string | null | undefined): Record<string, unknown> {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function withStatsField(stats: string | null | undefined, patch: Record<string, unknown>): string {
  let base: Record<string, unknown> = {};
  try {
    base = stats ? (JSON.parse(stats) as Record<string, unknown>) : {};
  } catch {
    base = {};
  }
  return JSON.stringify({ ...base, ...patch });
}

/**
 * 生活复盘（life-recap）运行成功后，把报告同步为「反思」维度的周期复盘草稿：
 * insights 存报告全文，dataSummary 记录来源与数据血缘（runId / engine / entryCount）。
 * 技能 config 里 syncReview: false 可关闭。
 */
async function maybeSyncReviewToPeriodicReview(
  userId: string,
  slug: string,
  skillRecord: { id: string; config?: string | null },
  start: Date,
  end: Date,
  run: { id: string; summary?: string | null; result?: string | null; stats?: string | null },
): Promise<string | null> {
  if (slug !== 'life-recap') return null;
  if (parseSkillConfig(skillRecord.config).syncReview === false) return null;

  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400e3));
  const period = spanDays <= 1 ? 'daily' : spanDays <= 10 ? 'weekly' : 'monthly';
  let stats: Record<string, unknown> = {};
  try {
    stats = run.stats ? (JSON.parse(run.stats) as Record<string, unknown>) : {};
  } catch {
    stats = {};
  }
  const review = await prisma.periodicReview.create({
    data: {
      userId,
      period,
      startDate: start,
      endDate: end,
      insights: run.result || '',
      dataSummary: JSON.stringify({
        source: 'melog:life-recap',
        runId: run.id,
        summary: run.summary,
        engine: stats.engine,
        entryCount: stats.entryCount,
      }),
    },
  });
  return review.id;
}

/**
 * 执行一个技能并落一条运行记录。
 * REST、MCP 与调度器共用；找不到技能记录时抛错（内置技能会先自动安装）。
 *
 * 引擎选择（技能 config JSON 的 engine 字段，默认 auto）：
 * - auto：配置了 LLM（MELOG_LLM_* 环境变量）则用模型生成，否则规则引擎
 * - llm：强制 LLM，失败回退规则引擎并在报告顶部注明原因
 * - rule：始终规则引擎
 */
export async function executeSkill(
  userId: string,
  slug: string,
  days?: number,
  periodStart?: Date,
  periodEnd?: Date,
  opts?: { llmFetchImpl?: typeof fetch },
): Promise<SkillRunResult> {
  const builtin = getBuiltinSkill(slug);
  const end = periodEnd || new Date();
  const start =
    periodStart || new Date(end.getTime() - (days || builtin?.defaultPeriodDays || 7) * 24 * 3600 * 1000);
  await ensureBuiltinSkills(userId);
  const skillRecord = await prisma.meLogSkill.findFirst({ where: { userId, slug } });
  if (!skillRecord) {
    throw new Error(`技能不存在或未安装：${slug}`);
  }

  if (!builtin) {
    const run = await prisma.meLogRun.create({
      data: {
        userId,
        skillId: skillRecord.id,
        status: 'failed',
        periodStart: start,
        periodEnd: end,
        summary: '该技能暂无可执行实现',
        result: `技能 **${slug}** 已安装，但当前 Skill Runner 只支持内置技能（health-insight / knowledge-recall / life-recap）。\n\n社区技能需要通过本地 Skill Runner 或 MCP 工具桥接执行，见 docs/实践/记录/标准.md。`,
      },
      include: { skill: { select: { name: true, slug: true } } },
    });
    return { run, result: run.result || '' };
  }

  const engine = getSkillEngine(skillRecord.config);
  if (engine === 'llm' || (engine === 'auto' && isLlmConfigured())) {
    try {
      const context = await gatherContextData(userId, start, end);
      const llm = await generateLlmReport({
        userId,
        slug,
        name: skillRecord.name,
        periodStart: start,
        periodEnd: end,
        context,
        fetchImpl: opts?.llmFetchImpl,
      });
      let run = await prisma.meLogRun.create({
        data: {
          userId,
          skillId: skillRecord.id,
          status: 'succeeded',
          periodStart: start,
          periodEnd: end,
          summary: llm.summary,
          result: llm.result,
          stats: JSON.stringify({ engine: 'llm', model: llm.model, entryCount: context.total }),
          entryIds: JSON.stringify(context.entries.map((entry) => entry.id)),
        },
        include: { skill: { select: { name: true, slug: true } } },
      });
      const linkedReviewId = await maybeSyncReviewToPeriodicReview(userId, slug, skillRecord, start, end, run);
      if (linkedReviewId) {
        run = await prisma.meLogRun.update({
          where: { id: run.id },
          data: { stats: withStatsField(run.stats, { linkedReviewId }) },
          include: { skill: { select: { name: true, slug: true } } },
        });
      }
      await prisma.meLogSkill.update({ where: { id: skillRecord.id }, data: { lastRunAt: new Date() } });
      return { run, result: llm.result };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return runBuiltin(
        builtin,
        skillRecord,
        userId,
        start,
        end,
        `> ⚠️ LLM 运行失败，已回退到规则引擎：${reason}\n\n`,
      );
    }
  }

  return runBuiltin(builtin, skillRecord, userId, start, end);
}
