import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  ingestEntries,
  getOverview,
  executeSkill,
  MELOG_CATEGORIES,
  type IngestInput,
} from './service.js';
import { ensureBuiltinSkills } from './skills.js';
import { computeNextRunAt } from './scheduler.js';
import { parseCaptureText, commitCaptures } from './capture.js';
import { searchFilter } from './search.js';

// ==================== 校验 Schema ====================

declare module 'fastify' {
  interface FastifyRequest {
    /** Bearer melt_… 连接器令牌鉴权成功后挂载，用于数据源作用域限制 */
    connectorToken?: { id: string; sourceId: string | null };
  }
}

const categoryEnum = z.enum(MELOG_CATEGORIES);

const entryInputSchema = z.object({
  externalId: z.string().max(255).optional(),
  category: categoryEnum,
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  content: z.string().max(100_000).optional(),
  payload: z.string().max(100_000).optional(),
  tags: z.string().max(500).optional(),
  actor: z.string().max(200).optional(),
  occurredAt: z.union([z.string(), z.date()]),
});

const ingestSchema = z.object({
  sourceId: z.string().optional(),
  source: z
    .object({
      adapter: z.string().min(1).max(100),
      name: z.string().min(1).max(200),
      category: categoryEnum.optional(),
      endpoint: z
        .string()
        .max(2000)
        .refine((v) => v === '' || /^https?:\/\//.test(v), 'endpoint 仅支持 http/https 地址')
        .optional(),
      config: z.string().max(10_000).optional(),
    })
    .optional(),
  entries: z.array(entryInputSchema).min(1).max(500),
});

const captureSchema = z.object({
  text: z.string().min(1).max(5000),
  exclude: z.array(z.number().int().min(0)).max(100).optional(),
});

const listEntriesSchema = z.object({
  category: categoryEnum.optional(),
  sourceId: z.string().optional(),
  from: z
    .union([z.string(), z.date()])
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  to: z
    .union([z.string(), z.date()])
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  q: z.string().max(200).optional(),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => Math.min(Math.max(Number(v) || 50, 1), 200)),
  offset: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => Math.max(Number(v) || 0, 0)),
});

const createSourceSchema = z.object({
  name: z.string().min(1).max(200),
  category: categoryEnum,
  adapter: z.string().min(1).max(100),
  endpoint: z
    .string()
    .max(2000)
    .refine((v) => v === '' || /^https?:\/\//.test(v), 'endpoint 仅支持 http/https 地址')
    .optional(),
  config: z.string().max(10_000).optional(),
});

const updateSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  endpoint: z
    .string()
    .max(2000)
    .refine((v) => v === '' || /^https?:\/\//.test(v), 'endpoint 仅支持 http/https 地址')
    .optional(),
  config: z.string().max(10_000).optional(),
  status: z.enum(['connected', 'disconnected', 'error']).optional(),
  isActive: z.boolean().optional(),
});

const createSkillSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/, 'slug 仅允许小写字母、数字和中划线'),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  version: z.string().max(50).optional(),
  source: z.enum(['community', 'custom']).optional(),
  config: z.string().max(10_000).optional(),
});

const runSkillSchema = z.object({
  days: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : Math.min(Math.max(Number(v), 1), 365))),
  periodStart: z
    .union([z.string(), z.date()])
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  periodEnd: z
    .union([z.string(), z.date()])
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

const upsertScheduleSchema = z
  .object({
    skillId: z.string().min(1),
    kind: z.enum(['daily', 'interval']),
    dailyAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'dailyAt 需要 HH:mm 格式').optional(),
    intervalHours: z.number().int().min(1).max(168).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => (v.kind === 'daily' ? !!v.dailyAt : !!v.intervalHours), {
    message: 'daily 需要 dailyAt（HH:mm），interval 需要 intervalHours（1-168）',
  });

const updateSkillSchema = z.object({
  config: z
    .string()
    .max(10_000)
    .refine(
      (v) => {
        try {
          return typeof JSON.parse(v) === 'object' && JSON.parse(v) !== null;
        } catch {
          return false;
        }
      },
      'config 需要是 JSON 对象字符串，如 {"engine":"llm"}',
    )
    .optional(),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  sourceId: z.string().optional(),
});

// ==================== 路由 ====================

export const melogRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = { onRequest: [fastify.authenticate] };

  /**
   * ingest 专用鉴权：支持 JWT（完整权限）或 `Bearer melt_…` 连接器令牌
   * （仅 ingest，且受数据源绑定限制）。连接器令牌不经过 JWT 校验。
   */
  const ingestAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (bearer.startsWith('melt_')) {
      const record = await prisma.meLogConnectorToken.findUnique({
        where: { tokenHash: sha256(bearer) },
      });
      if (!record) {
        return reply.code(401).send({ error: '无效的连接器令牌' });
      }
      request.user = { userId: record.userId };
      request.connectorToken = { id: record.id, sourceId: record.sourceId };
      await prisma.meLogConnectorToken.update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      });
      return;
    }
    // 其余情况走标准鉴权（JWT / 开发旁路）
    return fastify.authenticate(request, reply);
  };

  // ---------- 总览 ----------

  fastify.get('/overview', auth, async (request) => {
    return getOverview(request.user.userId);
  });

  // ---------- 数据源 ----------

  fastify.get('/sources', auth, async (request) => {
    const sources = await prisma.meLogSource.findMany({
      where: { userId: request.user.userId },
      orderBy: { updatedAt: 'desc' },
    });
    return { sources };
  });

  fastify.post('/sources', auth, async (request, reply) => {
    try {
      const data = createSourceSchema.parse(request.body);
      const source = await prisma.meLogSource.create({
        data: { ...data, userId: request.user.userId },
      });
      return reply.code(201).send({ source });
    } catch (error) {
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  fastify.patch('/sources/:id', auth, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateSourceSchema.parse(request.body);
      const existing = await prisma.meLogSource.findFirst({ where: { id, userId: request.user.userId } });
      if (!existing) return reply.code(404).send({ error: '数据源不存在' });
      const source = await prisma.meLogSource.update({ where: { id }, data });
      return { source };
    } catch (error) {
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  fastify.delete('/sources/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await prisma.meLogSource.deleteMany({ where: { id, userId: request.user.userId } });
    if (result.count === 0) return reply.code(404).send({ error: '数据源不存在' });
    return { success: true };
  });

  // ---------- 条目 / Ingest ----------

  fastify.get('/entries', auth, async (request, reply) => {
    try {
      const query = listEntriesSchema.parse(request.query);
      const search = await searchFilter(request.user.userId, query.q);
      const where: Prisma.MeLogEntryWhereInput = {
        userId: request.user.userId,
        ...(query.category ? { category: query.category } : {}),
        ...(query.sourceId ? { sourceId: query.sourceId } : {}),
        occurredAt: {
          ...(query.from ? { gte: query.from } : {}),
          ...(query.to ? { lte: query.to } : {}),
        },
        ...(search || {}),
      };

      const [entries, total] = await Promise.all([
        prisma.meLogEntry.findMany({
          where,
          orderBy: { occurredAt: 'desc' },
          take: query.limit,
          skip: query.offset,
          include: { source: { select: { name: true, adapter: true, category: true } } },
        }),
        prisma.meLogEntry.count({ where }),
      ]);
      return { entries, total };
    } catch (error) {
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  fastify.get('/entries/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = await prisma.meLogEntry.findFirst({
      where: { id, userId: request.user.userId },
      include: { source: { select: { name: true, adapter: true, category: true } } },
    });
    if (!entry) return reply.code(404).send({ error: '条目不存在' });
    return { entry };
  });

  fastify.post('/entries', auth, async (request, reply) => {
    try {
      const data = entryInputSchema.parse(request.body);
      const occurredAt = new Date(data.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        return reply.code(400).send({ error: 'occurredAt 不是有效时间' });
      }
      // 手动创建的条目挂在用户的 webhook 手动入口数据源上
      const source = await resolveManualSource(request.user.userId);
      const entry = await prisma.meLogEntry.create({
        data: { ...data, occurredAt, userId: request.user.userId, sourceId: source.id },
      });
      await refreshSourceStats(source.id);
      return reply.code(201).send({ entry });
    } catch (error) {
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  fastify.delete('/entries/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = await prisma.meLogEntry.findFirst({ where: { id, userId: request.user.userId } });
    if (!entry) return reply.code(404).send({ error: '条目不存在' });
    await prisma.meLogEntry.delete({ where: { id } });
    await refreshSourceStats(entry.sourceId);
    return { success: true };
  });

  fastify.post('/ingest', { onRequest: [ingestAuth] }, async (request, reply) => {
    try {
      const input = ingestSchema.parse(request.body) as IngestInput;
      const scoped = request.connectorToken?.sourceId ?? null;
      if (scoped) {
        if (input.sourceId && input.sourceId !== scoped) {
          return reply.code(403).send({ error: '令牌仅限写入绑定的数据源' });
        }
        if (input.source) {
          return reply.code(403).send({ error: '绑定数据源的令牌不能内联指定其他数据源' });
        }
        input.sourceId = scoped;
      }
      const result = await ingestEntries(request.user.userId, input);
      return { ...result };
    } catch (error) {
      if (error instanceof Error && error.message === '数据源不存在') {
        return reply.code(404).send({ error: error.message });
      }
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  // ---------- 连接器令牌 ----------

  fastify.get('/tokens', auth, async (request) => {
    const tokens = await prisma.meLogConnectorToken.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        sourceId: true,
        lastUsedAt: true,
        createdAt: true,
        source: { select: { name: true, adapter: true } },
      },
    });
    return { tokens };
  });

  fastify.post('/tokens', auth, async (request, reply) => {
    try {
      const data = createTokenSchema.parse(request.body);
      if (data.sourceId) {
        const source = await prisma.meLogSource.findFirst({
          where: { id: data.sourceId, userId: request.user.userId },
        });
        if (!source) return reply.code(404).send({ error: '数据源不存在' });
      }
      const secret = `melt_${randomBytes(24).toString('hex')}`;
      const token = await prisma.meLogConnectorToken.create({
        data: {
          userId: request.user.userId,
          name: data.name,
          sourceId: data.sourceId,
          tokenHash: sha256(secret),
        },
        include: { source: { select: { name: true, adapter: true } } },
      });
      // 明文仅此一次返回
      return reply.code(201).send({ token, secret });
    } catch (error) {
      return handleZodError(error, reply, () => {
        fastify.log.error(error);
        return reply.code(500).send({ error: '服务器错误' });
      });
    }
  });

  fastify.delete('/tokens/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await prisma.meLogConnectorToken.deleteMany({
      where: { id, userId: request.user.userId },
    });
    if (result.count === 0) return reply.code(404).send({ error: '令牌不存在' });
    return { success: true };
  });

  // ---------- 口述打卡 ----------

  fastify.post('/capture/parse', auth, async (request, reply) => {
    try {
      const { text } = captureSchema.parse(request.body);
      return { items: parseCaptureText(text) };
    } catch (error) {
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  fastify.post('/capture', auth, async (request, reply) => {
    try {
      const { text, exclude } = captureSchema.parse(request.body);
      const items = parseCaptureText(text).filter((item) => !exclude?.includes(item.index));
      if (items.length === 0) {
        return reply.code(400).send({ error: '没有可提交的条目' });
      }
      const result = await commitCaptures(request.user.userId, items);
      return reply.code(201).send({ ...result, items });
    } catch (error) {
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  // ---------- 技能 ----------

  fastify.get('/skills', auth, async (request) => {
    await ensureBuiltinSkills(request.user.userId);
    const skills = await prisma.meLogSkill.findMany({
      where: { userId: request.user.userId },
      orderBy: [{ source: 'asc' }, { createdAt: 'asc' }],
    });
    return { skills };
  });

  fastify.post('/skills', auth, async (request, reply) => {
    try {
      const data = createSkillSchema.parse(request.body);
      const existing = await prisma.meLogSkill.findUnique({
        where: { userId_slug: { userId: request.user.userId, slug: data.slug } },
      });
      if (existing) return reply.code(409).send({ error: '同名技能已安装' });
      const skill = await prisma.meLogSkill.create({
        data: { ...data, userId: request.user.userId },
      });
      return reply.code(201).send({ skill });
    } catch (error) {
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  fastify.patch('/skills/:id', auth, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateSkillSchema.parse(request.body);
      const existing = await prisma.meLogSkill.findFirst({ where: { id, userId: request.user.userId } });
      if (!existing) return reply.code(404).send({ error: '技能不存在' });
      const skill = await prisma.meLogSkill.update({ where: { id }, data });
      return { skill };
    } catch (error) {
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  fastify.delete('/skills/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const skill = await prisma.meLogSkill.findFirst({ where: { id, userId: request.user.userId } });
    if (!skill) return reply.code(404).send({ error: '技能不存在' });
    if (skill.source === 'builtin') return reply.code(400).send({ error: '内置技能不可卸载' });
    await prisma.meLogSkill.delete({ where: { id } });
    return { success: true };
  });

  fastify.get('/runs', auth, async (request) => {
    const { skillId } = request.query as { skillId?: string };
    const runs = await prisma.meLogRun.findMany({
      where: { userId: request.user.userId, ...(skillId ? { skillId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { skill: { select: { name: true, slug: true } } },
    });
    return { runs };
  });

  fastify.get('/runs/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await prisma.meLogRun.findFirst({
      where: { id, userId: request.user.userId },
      include: { skill: { select: { name: true, slug: true } } },
    });
    if (!run) return reply.code(404).send({ error: '运行记录不存在' });
    return { run };
  });

  fastify.post('/skills/:id/run', auth, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const skill = await prisma.meLogSkill.findFirst({ where: { id, userId: request.user.userId } });
      if (!skill) return reply.code(404).send({ error: '技能不存在' });

      const { days, periodStart, periodEnd } = runSkillSchema.parse(request.body || {});
      const result = await executeSkill(request.user.userId, skill.slug, days, periodStart, periodEnd);
      return reply.code(201).send({ run: result.run, report: result.result });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('技能')) {
        return reply.code(400).send({ error: error.message });
      }
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  // ---------- 定时调度 ----------

  fastify.get('/schedules', auth, async (request) => {
    const schedules = await prisma.meLogSchedule.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'asc' },
      include: { skill: { select: { name: true, slug: true } } },
    });
    return { schedules };
  });

  fastify.post('/schedules', auth, async (request, reply) => {
    try {
      const data = upsertScheduleSchema.parse(request.body);
      const skill = await prisma.meLogSkill.findFirst({
        where: { id: data.skillId, userId: request.user.userId },
      });
      if (!skill) return reply.code(404).send({ error: '技能不存在' });

      const nextRunAt = data.enabled === false ? null : computeNextRunAt(data.kind, data.dailyAt || null, data.intervalHours || null, new Date());
      const schedule = await prisma.meLogSchedule.upsert({
        where: { userId_skillId: { userId: request.user.userId, skillId: data.skillId } },
        update: {
          kind: data.kind,
          dailyAt: data.dailyAt,
          intervalHours: data.intervalHours,
          enabled: data.enabled ?? true,
          nextRunAt,
        },
        create: {
          userId: request.user.userId,
          skillId: data.skillId,
          kind: data.kind,
          dailyAt: data.dailyAt,
          intervalHours: data.intervalHours,
          enabled: data.enabled ?? true,
          nextRunAt,
        },
        include: { skill: { select: { name: true, slug: true } } },
      });
      return { schedule };
    } catch (error) {
      return handleZodError(error, reply, () => {
        throw error;
      });
    }
  });

  fastify.delete('/schedules/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await prisma.meLogSchedule.deleteMany({
      where: { id, userId: request.user.userId },
    });
    if (result.count === 0) return reply.code(404).send({ error: '调度不存在' });
    return { success: true };
  });

  // ---------- MCP 端点（Streamable HTTP，JSON 响应） ----------

  fastify.post('/mcp', auth, async (request, reply) => {
    const body = request.body as JsonRpcRequest | undefined;
    if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
      return reply.send(jsonRpcError(null, -32600, 'Invalid Request：需要 JSON-RPC 2.0 请求体'));
    }

    // 通知不需要响应
    if (body.method.startsWith('notifications/')) {
      return reply.code(202).send();
    }

    try {
      const result = await handleJsonRpc(request.user.userId, body);
      return reply.send({ jsonrpc: '2.0', id: body.id ?? null, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : '内部错误';
      return reply.send(jsonRpcError(body.id ?? null, -32603, message));
    }
  });
};

// ==================== 辅助 ====================

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function resolveManualSource(userId: string) {
  return prisma.meLogSource.upsert({
    where: { userId_adapter_name: { userId, adapter: 'manual', name: '手动记录' } },
    update: {},
    create: { userId, adapter: 'manual', name: '手动记录', category: 'custom', status: 'connected' },
  });
}

async function refreshSourceStats(sourceId: string) {
  const entryCount = await prisma.meLogEntry.count({ where: { sourceId } });
  await prisma.meLogSource.update({ where: { id: sourceId }, data: { entryCount } });
}

type ZodHandler = () => unknown;

function handleZodError(error: unknown, reply: { code: (code: number) => { send: (body: unknown) => unknown } }, fallback: ZodHandler) {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({ error: '参数校验失败', details: error.errors });
  }
  return fallback();
}

// ==================== MCP (JSON-RPC 2.0) ====================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const MCP_PROTOCOL_VERSION = '2024-11-05';

const mcpTools: JsonRpcTool[] = [
  {
    name: 'melog_get_overview',
    description: '获取 MeLog 数据总览：分类条目统计、数据源健康状态、最近的技能运行记录',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'melog_query_entries',
    description: '查询统一时间线条目（健康/笔记/IM 聊天等），支持按分类、来源、时间范围和关键词过滤',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: MELOG_CATEGORIES, description: '条目分类' },
        sourceId: { type: 'string', description: '数据源 ID' },
        from: { type: 'string', description: '起始时间 ISO 8601' },
        to: { type: 'string', description: '结束时间 ISO 8601' },
        q: { type: 'string', description: '关键词（匹配标题/内容/参与者）' },
        limit: { type: 'number', description: '返回条数，默认 50，最大 200' },
      },
    },
  },
  {
    name: 'melog_ingest_entries',
    description: '按 MeLog Standard 批量写入条目，以 (adapter+name, externalId) 幂等去重',
    inputSchema: {
      type: 'object',
      required: ['adapter', 'name', 'entries'],
      properties: {
        adapter: { type: 'string', description: '连接器标识，如 chatlog / apple-health / obsidian' },
        name: { type: 'string', description: '数据源显示名，如 微信聊天记录' },
        category: { type: 'string', enum: MELOG_CATEGORIES, description: '数据源分类，默认 custom' },
        entries: {
          type: 'array',
          maxItems: 500,
          items: {
            type: 'object',
            required: ['category', 'type', 'title', 'occurredAt'],
            properties: {
              externalId: { type: 'string', description: '来源系统唯一 ID，用于幂等' },
              category: { type: 'string', enum: MELOG_CATEGORIES },
              type: { type: 'string', description: '细分类型，如 sleep / chat-message / markdown-doc' },
              title: { type: 'string' },
              content: { type: 'string' },
              payload: { type: 'string', description: 'JSON 字符串：结构化数据' },
              tags: { type: 'string', description: '逗号分隔标签' },
              actor: { type: 'string', description: '参与者/作者' },
              occurredAt: { type: 'string', description: '发生时间 ISO 8601' },
            },
          },
        },
      },
    },
  },
  {
    name: 'melog_run_skill',
    description: '运行一个 MeLog 技能并返回 Markdown 报告。内置：health-insight / knowledge-recall / life-recap',
    inputSchema: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', description: '技能标识' },
        days: { type: 'number', description: '回溯天数，默认按技能配置' },
        periodStart: { type: 'string', description: '起始时间 ISO 8601（优先于 days）' },
        periodEnd: { type: 'string', description: '结束时间 ISO 8601' },
      },
    },
  },
];

async function handleJsonRpc(userId: string, body: JsonRpcRequest): Promise<Record<string, unknown>> {
  switch (body.method) {
    case 'initialize':
      return {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'melog', version: '0.1.0' },
      };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: mcpTools };
    case 'tools/call': {
      const name = String(body.params?.name || '');
      const args = (body.params?.arguments || {}) as Record<string, unknown>;
      const text = await callMcpTool(userId, name, args);
      return { content: [{ type: 'text', text }], isError: false };
    }
    default:
      throw new Error(`未知方法：${body.method}`);
  }
}

async function callMcpTool(userId: string, name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'melog_get_overview':
      return JSON.stringify(await getOverview(userId), null, 2);

    case 'melog_query_entries': {
      const query = listEntriesSchema.parse({
        category: args.category,
        sourceId: args.sourceId,
        from: args.from,
        to: args.to,
        q: args.q,
        limit: args.limit ?? 50,
      });
      const entries = await prisma.meLogEntry.findMany({
        where: {
          userId,
          ...(query.category ? { category: query.category } : {}),
          ...(query.sourceId ? { sourceId: query.sourceId } : {}),
          occurredAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
          ...(query.q
            ? {
                OR: [
                  { title: { contains: query.q } },
                  { content: { contains: query.q } },
                  { actor: { contains: query.q } },
                ],
              }
            : {}),
        },
        orderBy: { occurredAt: 'desc' },
        take: query.limit,
      });
      return JSON.stringify({ total: entries.length, entries }, null, 2);
    }

    case 'melog_ingest_entries': {
      const input = ingestSchema.parse({
        source: {
          adapter: args.adapter,
          name: args.name,
          category: args.category,
        },
        entries: args.entries,
      });
      const result = await ingestEntries(userId, input);
      return JSON.stringify(result, null, 2);
    }

    case 'melog_run_skill': {
      const slug = String(args.slug || '');
      const { days, periodStart, periodEnd } = runSkillSchema.parse({
        days: args.days,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
      });
      const { run } = await executeSkill(userId, slug, days, periodStart, periodEnd);
      return JSON.stringify(
        { status: run.status, summary: run.summary, report: run.result },
        null,
        2,
      );
    }

    default:
      throw new Error(`未知工具：${name}，可用工具：${mcpTools.map((t) => t.name).join(', ')}`);
  }
}

function jsonRpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
