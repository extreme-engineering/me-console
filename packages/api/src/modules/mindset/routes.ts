import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const categories = ['整体置顶', '生活', '工作', '身体', '心理', '物品', '经济'] as const;

const createMindsetSchema = z.object({
  content: z.string().min(1).max(500),
  category: z.enum(categories),
  order: z.number().int().min(0).optional(),
});

const updateMindsetSchema = z.object({
  content: z.string().min(1).max(500).optional(),
  category: z.enum(categories).optional(),
  order: z.number().int().min(0).optional(),
});

export const mindsetRoutes: FastifyPluginAsync = async (fastify) => {
  // 获取用户所有心态格言
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request, _reply) => {
    try {
      const userId = request.user.userId;
      const slogans = await prisma.mindsetSlogan.findMany({
        where: { userId },
        orderBy: [
          { category: 'asc' },
          { order: 'asc' },
        ],
      });
      return { slogans };
    } catch (error) {
      throw error;
    }
  });

  // 创建心态格言
  fastify.post('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const data = createMindsetSchema.parse(request.body);

      const slogan = await prisma.mindsetSlogan.create({
        data: {
          ...data,
          userId,
        },
      });

      return { slogan };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  // 更新心态格言
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = updateMindsetSchema.parse(request.body);

      const slogan = await prisma.mindsetSlogan.updateMany({
        where: { id, userId },
        data,
      });

      if (slogan.count === 0) {
        return reply.code(404).send({ error: '格言不存在' });
      }

      const updated = await prisma.mindsetSlogan.findUnique({ where: { id } });
      return { slogan: updated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  // 删除心态格言
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };

      const slogan = await prisma.mindsetSlogan.deleteMany({
        where: { id, userId },
      });

      if (slogan.count === 0) {
        return reply.code(404).send({ error: '格言不存在' });
      }

      return { success: true };
    } catch (error) {
      throw error;
    }
  });
};