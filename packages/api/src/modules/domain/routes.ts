import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const updateDomainSchema = z.object({
  name: z.string().optional(),
  icon: z.string().optional(),
  weight: z.number().min(1).max(10).optional(),
  description: z.string().optional(),
  order: z.number().optional(),
});

const createDomainSchema = z.object({
  name: z.string().min(1),
  identifier: z.string().min(1),
  icon: z.string().optional(),
  weight: z.number().min(1).max(10).default(1),
  description: z.string().optional(),
  order: z.number().optional(),
});

export const domainRoutes: FastifyPluginAsync = async (fastify) => {
  const isDev = process.env.NODE_ENV !== 'production';

  const defaultDomains = [
    { id: 'dev-1', identifier: 'Career', name: '职业发展', icon: '💼', weight: 1, order: 1 },
    { id: 'dev-2', identifier: 'Health', name: '身心健康', icon: '💪', weight: 1, order: 2 },
    { id: 'dev-3', identifier: 'Family', name: '家庭关系', icon: '👨‍👩‍👧‍👦', weight: 1, order: 3 },
    { id: 'dev-4', identifier: 'Finance', name: '财务状况', icon: '💰', weight: 1, order: 4 },
    { id: 'dev-5', identifier: 'Learning', name: '学习成长', icon: '📚', weight: 1, order: 5 },
    { id: 'dev-6', identifier: 'Social', name: '社交人际', icon: '🤝', weight: 1, order: 6 },
    { id: 'dev-7', identifier: 'Leisure', name: '休闲娱乐', icon: '🎮', weight: 1, order: 7 },
    { id: 'dev-8', identifier: 'Spirituality', name: '精神世界', icon: '🧘', weight: 1, order: 8 },
  ];

  // 获取用户所有领域
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, _reply) => {
      try {
        const userId = request.user.userId;
        if (isDev && (!userId || userId === 'mock-user-1')) {
          return { domains: defaultDomains };
        }
        const domains = await prisma.domain.findMany({
          where: { userId },
          orderBy: { order: 'asc' },
        });
        return { domains };
      } catch (error) {
        throw error;
      }
    },
  });

  // 更新领域
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };
        const data = updateDomainSchema.parse(request.body);

        const domain = await prisma.domain.updateMany({
          where: { id, userId },
          data,
        });

        if (domain.count === 0) {
          return reply.code(404).send({ error: '领域不存在' });
        }

        const updated = await prisma.domain.findUnique({ where: { id } });
        return { domain: updated };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 创建领域
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const data = createDomainSchema.parse(request.body);

        const domain = await prisma.domain.create({
          data: {
            ...data,
            userId,
          },
        });

        return { domain };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 删除领域
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const result = await prisma.domain.deleteMany({
          where: { id, userId },
        });

        if (result.count === 0) {
          return reply.code(404).send({ error: '领域不存在' });
        }

        return { success: true };
      } catch (error) {
        throw error;
      }
    },
  });
};
