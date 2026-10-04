import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const insightSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export const insightRoutes: FastifyPluginAsync = async (fastify) => {
  // 创建洞察笔记
  fastify.post('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const data = insightSchema.parse(request.body);

        const insight = await prisma.insightNote.create({
          data: {
            userId,
            title: data.title,
            content: data.content,
            tags: data.tags ? JSON.stringify(data.tags) : null,
            category: data.category,
          },
        });

        return { insight };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 获取洞察笔记列表
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, _reply) => {
      try {
        const userId = request.user.userId;
        const { category, limit = 50, search, page = 1, sortBy = 'createdAt', sortOrder = 'desc' } = request.query as {
          category?: string;
          limit?: number;
          search?: string;
          page?: number;
          sortBy?: string;
          sortOrder?: 'asc' | 'desc';
        };

        const where: Prisma.InsightNoteWhereInput = { userId };
        if (category) where.category = category;
        if (search) {
          where.OR = [
            { title: { contains: search } },
            { content: { contains: search } },
          ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const orderBy = { [sortBy]: sortOrder } as Prisma.InsightNoteOrderByWithRelationInput;

        const [insights, total] = await Promise.all([
          prisma.insightNote.findMany({
            where,
            orderBy,
            take: Number(limit),
            skip,
          }),
          prisma.insightNote.count({ where }),
        ]);

        return { insights, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } };
      } catch (error) {
        throw error;
      }
    },
  });

  // 获取单个洞察笔记
  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const insight = await prisma.insightNote.findFirst({
          where: { id, userId },
        });

        if (!insight) {
          return reply.code(404).send({ error: '洞察笔记不存在' });
        }

        return { insight };
      } catch (error) {
        throw error;
      }
    },
  });

  // 更新洞察笔记
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };
        const data = insightSchema.partial().parse(request.body);

        const existing = await prisma.insightNote.findFirst({ where: { id, userId } });
        if (!existing) {
          return reply.code(404).send({ error: '洞察笔记不存在' });
        }

        const insight = await prisma.insightNote.update({
          where: { id },
          data: {
            ...data,
            tags: data.tags ? JSON.stringify(data.tags) : undefined,
          },
        });

        return { insight };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  // 删除洞察笔记
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const result = await prisma.insightNote.deleteMany({
          where: { id, userId },
        });

        if (result.count === 0) {
          return reply.code(404).send({ error: '洞察笔记不存在' });
        }

        return { success: true };
      } catch (error) {
        throw error;
      }
    },
  });
};
