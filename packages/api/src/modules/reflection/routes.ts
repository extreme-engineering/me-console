import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const reflectionSchema = z.object({
  date: z.string().datetime().optional(),
  type: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).default('daily'),
  celebrations: z.array(z.string()).optional(),
  improvements: z.array(z.string()).optional(),
  tomorrow: z.string().optional(),
  content: z.string().optional(),
  mood: z.string().optional(),
  tags: z.array(z.string()).optional(),
  domainId: z.string().optional(),
});

const todaySummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date 需要 yyyy-MM-dd 格式').optional(),
});

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

function localDayBounds(date?: string): { start: Date; end: Date } {
  const start = date ? new Date(`${date}T00:00:00`) : new Date();
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

export const reflectionRoutes: FastifyPluginAsync = async (fastify) => {
  // 创建反思
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const data = reflectionSchema.parse(request.body);

        const reflection = await prisma.reflection.create({
          data: {
            userId,
            date: data.date ? new Date(data.date) : new Date(),
            type: data.type,
            celebrations: data.celebrations ? JSON.stringify(data.celebrations) : null,
            improvements: data.improvements ? JSON.stringify(data.improvements) : null,
            tomorrow: data.tomorrow,
            content: data.content,
            mood: data.mood,
            tags: data.tags ? JSON.stringify(data.tags) : null,
            domainId: data.domainId,
          },
        });

        return { reflection };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 当日数据聚合（每日反思自动带入）
  fastify.get('/today-summary', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { date } = todaySummarySchema.parse(request.query);
        const { start, end } = localDayBounds(date);

        const [todosDone, todosCreated, habitLogs, healthRecords] = await Promise.all([
          prisma.todo.findMany({
            where: { userId, completedAt: { gte: start, lt: end } },
            orderBy: { completedAt: 'asc' },
            take: 20,
          }),
          prisma.todo.count({ where: { userId, createdAt: { gte: start, lt: end } } }),
          prisma.habitLog.findMany({
            where: { date: { gte: start, lt: end }, habit: { userId } },
            include: { habit: { select: { title: true } } },
            orderBy: { date: 'asc' },
          }),
          prisma.healthRecord.findMany({
            where: { userId, recordedAt: { gte: start, lt: end } },
            orderBy: { recordedAt: 'asc' },
          }),
        ]);

        const lines: string[] = [];
        if (todosDone.length > 0) {
          lines.push(`待办完成 ${todosDone.length} 条${todosCreated > 0 ? `（今日新增 ${todosCreated} 条）` : ''}`);
        }
        if (habitLogs.length > 0) {
          lines.push(`习惯打卡 ${habitLogs.length} 项（${habitLogs.map((l) => l.habit.title).join('、')}）`);
        }
        if (healthRecords.length > 0) {
          lines.push(`健康记录 ${healthRecords.length} 条（${healthRecords.map(formatHealthItem).join('、')}）`);
        }

        return {
          date: localDateKey(start),
          todos: { total: todosDone.length, createdToday: todosCreated, items: todosDone.map((t) => t.title) },
          habits: { total: habitLogs.length, items: habitLogs.map((l) => l.habit.title) },
          health: {
            total: healthRecords.length,
            items: healthRecords.map((r) => ({ type: r.type, value: r.value, unit: r.unit, label: formatHealthItem(r) })),
          },
          summary: lines.join('；'),
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 获取反思列表
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, _reply) => {
      try {
        const userId = request.user.userId;
        const { type, limit = 20, page = 1 } = request.query as { type?: string; limit?: number; page?: number };

        const where: Prisma.ReflectionWhereInput = { userId };
        if (type) where.type = type;

        const skip = (Number(page) - 1) * Number(limit);

        const [reflections, total] = await Promise.all([
          prisma.reflection.findMany({
            where,
            include: { domain: true },
            orderBy: { date: 'desc' },
            take: Number(limit),
            skip,
          }),
          prisma.reflection.count({ where }),
        ]);

        return { reflections, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } };
      } catch (error) {
        throw error;
      }
    },
  });

  // 获取单个反思
  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const reflection = await prisma.reflection.findFirst({
          where: { id, userId },
          include: { domain: true },
        });

        if (!reflection) {
          return reply.code(404).send({ error: '反思不存在' });
        }

        return { reflection };
      } catch (error) {
        throw error;
      }
    },
  });

  // 更新反思
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };
        const data = reflectionSchema.partial().parse(request.body);

        const existing = await prisma.reflection.findFirst({ where: { id, userId } });
        if (!existing) {
          return reply.code(404).send({ error: '反思不存在' });
        }

        const reflection = await prisma.reflection.update({
          where: { id },
          data: {
            ...data,
            date: data.date ? new Date(data.date) : undefined,
            celebrations: data.celebrations ? JSON.stringify(data.celebrations) : undefined,
            improvements: data.improvements ? JSON.stringify(data.improvements) : undefined,
            tags: data.tags ? JSON.stringify(data.tags) : undefined,
          },
        });

        return { reflection };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 删除反思
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const result = await prisma.reflection.deleteMany({
          where: { id, userId },
        });

        if (result.count === 0) {
          return reply.code(404).send({ error: '反思不存在' });
        }

        return { success: true };
      } catch (error) {
        throw error;
      }
    },
  });
};
