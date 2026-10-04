import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const statusEnum = z.enum(['planned', 'active', 'completed', 'abandoned']);
const priorityEnum = z.enum(['high', 'medium', 'low']);

const createGoalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  domainId: z.string().min(1),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  order: z.number().int().min(0).optional(),
});

const updateGoalSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  domainId: z.string().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

const createKeyResultSchema = z.object({
  title: z.string().min(1),
  targetValue: z.number(),
  unit: z.string().min(1),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  order: z.number().int().min(0).optional(),
});

const updateKeyResultSchema = z.object({
  title: z.string().min(1).optional(),
  currentValue: z.number().optional(),
  targetValue: z.number().optional(),
  unit: z.string().min(1).optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  order: z.number().int().min(0).optional(),
});

export const goalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request, _reply) => {
    try {
      const userId = request.user.userId;
      const goals = await prisma.goal.findMany({
        where: { userId },
        orderBy: [
          { order: 'asc' },
          { updatedAt: 'desc' },
        ],
        include: {
          keyResults: true,
          _count: true,
        },
      });
      return { goals };
    } catch (error) {
      throw error;
    }
  });

  fastify.post('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const data = createGoalSchema.parse(request.body);
      const goal = await prisma.goal.create({
        data: {
          ...data,
          userId,
        },
      });
      return { goal };
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
    const userId = request.user.userId;
    const { id } = request.params as { id: string };
    const goal = await prisma.goal.findFirst({
      where: { id, userId },
      include: { keyResults: true },
    });
    if (!goal) {
      return reply.code(404).send({ error: '目标不存在' });
    }
    return { goal };
  });

  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = updateGoalSchema.parse(request.body);
      const result = await prisma.goal.updateMany({
        where: { id, userId },
        data,
      });
      if (result.count === 0) {
        return reply.code(404).send({ error: '目标不存在' });
      }
      const goal = await prisma.goal.findUnique({ where: { id } });
      return { goal };
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
      const result = await prisma.goal.deleteMany({
        where: { id, userId },
      });
      if (result.count === 0) {
        return reply.code(404).send({ error: '目标不存在' });
      }
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  fastify.post('/:id/key-results', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const goal = await prisma.goal.findFirst({ where: { id, userId } });
      if (!goal) {
        return reply.code(404).send({ error: '目标不存在' });
      }
      const data = createKeyResultSchema.parse(request.body);
      const keyResult = await prisma.keyResult.create({
        data: {
          ...data,
          goalId: id,
        },
      });
      return { keyResult };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.patch('/:id/key-results/:krId', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id, krId } = request.params as { id: string; krId: string };
      const goal = await prisma.goal.findFirst({ where: { id, userId } });
      if (!goal) {
        return reply.code(404).send({ error: '目标不存在' });
      }
      const data = updateKeyResultSchema.parse(request.body);
      const result = await prisma.keyResult.updateMany({
        where: { id: krId, goalId: id },
        data,
      });
      if (result.count === 0) {
        return reply.code(404).send({ error: '关键结果不存在' });
      }
      const keyResult = await prisma.keyResult.findUnique({ where: { id: krId } });
      return { keyResult };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.delete('/:id/key-results/:krId', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id, krId } = request.params as { id: string; krId: string };
      const goal = await prisma.goal.findFirst({ where: { id, userId } });
      if (!goal) {
        return reply.code(404).send({ error: '目标不存在' });
      }
      const result = await prisma.keyResult.deleteMany({
        where: { id: krId, goalId: id },
      });
      if (result.count === 0) {
        return reply.code(404).send({ error: '关键结果不存在' });
      }
      return { success: true };
    } catch (error) {
      throw error;
    }
  });
};
