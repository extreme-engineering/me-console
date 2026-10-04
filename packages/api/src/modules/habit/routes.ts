import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const createHabitSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  frequency: z.enum(['daily', 'weekly']).optional(),
  targetPerWeek: z.number().int().min(1).optional(),
  goalId: z.string().nullable().optional(),
  domainId: z.string().nullable().optional(),
  color: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

const updateHabitSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  frequency: z.enum(['daily', 'weekly']).optional(),
  targetPerWeek: z.number().int().min(1).nullable().optional(),
  goalId: z.string().nullable().optional(),
  domainId: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

const toggleLogSchema = z.object({
  date: z.string(),
  note: z.string().optional(),
});

const logsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const habitRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request, _reply) => {
    try {
      const userId = request.user.userId;
      const today = toDateString(new Date());

      const habits = await prisma.habit.findMany({
        where: { userId, isActive: true },
        orderBy: { order: 'asc' },
        include: {
          logs: {
            where: {
              date: {
                gte: new Date(today + 'T00:00:00.000Z'),
                lte: new Date(today + 'T23:59:59.999Z'),
              },
            },
          },
        },
      });

      return { habits };
    } catch (error) {
      throw error;
    }
  });

  fastify.post('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const data = createHabitSchema.parse(request.body);

      const habit = await prisma.habit.create({
        data: {
          userId,
          title: data.title,
          description: data.description,
          frequency: data.frequency,
          targetPerWeek: data.targetPerWeek,
          goalId: data.goalId,
          domainId: data.domainId,
          color: data.color,
          order: data.order ?? 0,
        },
      });

      return { habit };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const habit = await prisma.habit.findFirst({
        where: { id, userId },
        include: {
          logs: {
            where: {
              date: { gte: thirtyDaysAgo },
            },
            orderBy: { date: 'desc' },
          },
        },
      });

      if (!habit) {
        return reply.code(404).send({ error: '习惯不存在' });
      }

      return { habit };
    } catch (error) {
      throw error;
    }
  });

  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = updateHabitSchema.parse(request.body);

      const existing = await prisma.habit.findFirst({ where: { id, userId } });
      if (!existing) {
        return reply.code(404).send({ error: '习惯不存在' });
      }

      const habit = await prisma.habit.update({
        where: { id },
        data,
      });

      return { habit };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };

      const result = await prisma.habit.deleteMany({
        where: { id, userId },
      });

      if (result.count === 0) {
        return reply.code(404).send({ error: '习惯不存在' });
      }

      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  fastify.post('/:id/log', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = toggleLogSchema.parse(request.body);

      const habit = await prisma.habit.findFirst({ where: { id, userId } });
      if (!habit) {
        return reply.code(404).send({ error: '习惯不存在' });
      }

      const dateObj = new Date(data.date);
      const dateStr = toDateString(dateObj);
      const dayStart = new Date(dateStr + 'T00:00:00.000Z');
      const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

      const existingLog = await prisma.habitLog.findFirst({
        where: {
          habitId: id,
          date: { gte: dayStart, lte: dayEnd },
        },
      });

      if (existingLog) {
        await prisma.habitLog.delete({ where: { id: existingLog.id } });
        return { logged: false, log: null };
      }

      const log = await prisma.habitLog.create({
        data: {
          habitId: id,
          date: dateObj,
          note: data.note,
        },
      });

      return { logged: true, log };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.get('/:id/logs', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const query = logsQuerySchema.parse(request.query);

      const habit = await prisma.habit.findFirst({ where: { id, userId } });
      if (!habit) {
        return reply.code(404).send({ error: '习惯不存在' });
      }

      const to = query.to ? new Date(query.to) : new Date();
      const from = query.from
        ? new Date(query.from)
        : new Date(new Date().setDate(new Date().getDate() - 30));

      const logs = await prisma.habitLog.findMany({
        where: {
          habitId: id,
          date: { gte: from, lte: to },
        },
        orderBy: { date: 'desc' },
      });

      return { logs };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });
};
