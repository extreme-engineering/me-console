import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const reviewSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  achievements: z.array(z.string()).optional(),
  challenges: z.array(z.string()).optional(),
  insights: z.string().optional(),
  nextFocus: z.array(z.string()).optional(),
});

export const reviewRoutes: FastifyPluginAsync = async (fastify) => {
  // 创建复盘
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const data = reviewSchema.parse(request.body);

        const review = await prisma.periodicReview.create({
          data: {
            userId,
            period: data.period,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            achievements: data.achievements ? JSON.stringify(data.achievements) : null,
            challenges: data.challenges ? JSON.stringify(data.challenges) : null,
            insights: data.insights,
            nextFocus: data.nextFocus ? JSON.stringify(data.nextFocus) : null,
          },
        });

        return { review };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 获取复盘列表
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, _reply) => {
      try {
        const userId = request.user.userId;
        const { period, page = 1, limit = 20 } = request.query as { period?: string; page?: number; limit?: number };

        const where: Prisma.PeriodicReviewWhereInput = { userId };
        if (period) where.period = period;

        const skip = (Number(page) - 1) * Number(limit);

        const [reviews, total] = await Promise.all([
          prisma.periodicReview.findMany({
            where,
            orderBy: { startDate: 'desc' },
            take: Number(limit),
            skip,
          }),
          prisma.periodicReview.count({ where }),
        ]);

        return { reviews, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } };
      } catch (error) {
        throw error;
      }
    },
  });

  // 获取单个复盘
  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const review = await prisma.periodicReview.findFirst({
          where: { id, userId },
        });

        if (!review) {
          return reply.code(404).send({ error: '复盘不存在' });
        }

        return { review };
      } catch (error) {
        throw error;
      }
    },
  });

  // 更新复盘
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };
        const data = reviewSchema.partial().parse(request.body);

        const existing = await prisma.periodicReview.findFirst({ where: { id, userId } });
        if (!existing) {
          return reply.code(404).send({ error: '复盘不存在' });
        }

        const review = await prisma.periodicReview.update({
          where: { id },
          data: {
            ...data,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            endDate: data.endDate ? new Date(data.endDate) : undefined,
            achievements: data.achievements ? JSON.stringify(data.achievements) : undefined,
            challenges: data.challenges ? JSON.stringify(data.challenges) : undefined,
            nextFocus: data.nextFocus ? JSON.stringify(data.nextFocus) : undefined,
          },
        });

        return { review };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 删除复盘
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const result = await prisma.periodicReview.deleteMany({
          where: { id, userId },
        });

        if (result.count === 0) {
          return reply.code(404).send({ error: '复盘不存在' });
        }

        return { success: true };
      } catch (error) {
        throw error;
      }
    },
  });
};
