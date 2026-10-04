import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const scoreSchema = z.object({
  scores: z.array(
    z.object({
      domainId: z.string(),
      score: z.number().min(1).max(10),
      note: z.string().optional(),
    })
  ),
});

export const balanceWheelRoutes: FastifyPluginAsync = async (fastify) => {
  // 提交平衡轮评分
  fastify.post('/scores', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { scores } = scoreSchema.parse(request.body);

        const createdScores = await Promise.all(
          scores.map((score) =>
            prisma.balanceWheelScore.create({
              data: {
                userId,
                domainId: score.domainId,
                score: score.score,
                note: score.note,
              },
            })
          )
        );

        return { scores: createdScores };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 获取平衡轮历史数据
  fastify.get('/history', {
    onRequest: [fastify.authenticate],
    handler: async (request, _reply) => {
      try {
        const userId = request.user.userId;
        const { limit = 10 } = request.query as { limit?: number };

        const scores = await prisma.balanceWheelScore.findMany({
          where: { userId },
          include: { domain: true },
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
        });

        return { scores };
      } catch (error) {
        throw error;
      }
    },
  });

  // 获取单条评分记录
  fastify.get('/scores/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const score = await prisma.balanceWheelScore.findFirst({
          where: { id, userId },
          include: { domain: true },
        });

        if (!score) {
          return reply.code(404).send({ error: '评分记录不存在' });
        }

        return { score };
      } catch (error) {
        throw error;
      }
    },
  });

  // 更新评分记录
  fastify.patch('/scores/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };
        const data = scoreSchema.partial().parse(request.body);

        const existing = await prisma.balanceWheelScore.findFirst({ where: { id, userId } });
        if (!existing) {
          return reply.code(404).send({ error: '评分记录不存在' });
        }

        const score = await prisma.balanceWheelScore.update({
          where: { id },
          data: {
            score: data.scores?.[0]?.score ?? existing.score,
            note: data.scores?.[0]?.note ?? existing.note,
          },
        });

        return { score };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 删除评分记录
  fastify.delete('/scores/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const result = await prisma.balanceWheelScore.deleteMany({
          where: { id, userId },
        });

        if (result.count === 0) {
          return reply.code(404).send({ error: '评分记录不存在' });
        }

        return { success: true };
      } catch (error) {
        throw error;
      }
    },
  });
};
