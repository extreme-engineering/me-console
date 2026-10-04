import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const categories = ['心理', '身体', '工作', '生活'] as const;
const statuses = ['探索中', '研究中', '实践中', '突破', '持续中', '已归档'] as const;
const priorities = ['high', 'medium', 'low'] as const;
const noteTypes = ['reflection', 'insight', 'breakthrough', 'setback'] as const;

const createTopicSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(categories).optional(),
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  currentUnderstanding: z.string().optional(),
  actionPlan: z.string().optional(),
  relatedDomainId: z.string().optional(),
  goalId: z.string().optional(),
  order: z.number().optional(),
});

const updateTopicSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.enum(categories).optional(),
  status: z.enum(statuses).optional(),
  priority: z.enum(priorities).optional(),
  currentUnderstanding: z.string().nullable().optional(),
  actionPlan: z.string().nullable().optional(),
  relatedDomainId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  order: z.number().optional(),
  isMock: z.boolean().optional(),
});

const createNoteSchema = z.object({
  content: z.string().min(1),
  noteType: z.enum(noteTypes).optional(),
});

export const topicRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, _reply) => {
      try {
        const userId = request.user.userId;

        const topics = await prisma.topic.findMany({
          where: { userId },
          orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
          include: {
            notes: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            _count: {
              select: { notes: true },
            },
            insights: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            readingItems: true,
          },
        });

        return { topics };
      } catch (error) {
        throw error;
      }
    },
  });

  fastify.post('/', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const data = createTopicSchema.parse(request.body);

        const topic = await prisma.topic.create({
          data: {
            userId,
            title: data.title,
            description: data.description,
            category: data.category,
            status: data.status,
            priority: data.priority,
            currentUnderstanding: data.currentUnderstanding,
            actionPlan: data.actionPlan,
            relatedDomainId: data.relatedDomainId,
            goalId: data.goalId,
            order: data.order,
          },
        });

        return { topic };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const topic = await prisma.topic.findFirst({
          where: { id, userId },
          include: {
            notes: {
              orderBy: { createdAt: 'desc' },
            },
            insights: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            readingItems: true,
          },
        });

        if (!topic) {
          return reply.code(404).send({ error: '话题不存在' });
        }

        return { topic };
      } catch (error) {
        throw error;
      }
    },
  });

  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };
        const data = updateTopicSchema.parse(request.body);

        const existing = await prisma.topic.findFirst({ where: { id, userId } });
        if (!existing) {
          return reply.code(404).send({ error: '话题不存在' });
        }

        const topic = await prisma.topic.update({
          where: { id },
          data,
        });

        return { topic };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };

        const existing = await prisma.topic.findFirst({ where: { id, userId } });
        if (!existing) {
          return reply.code(404).send({ error: '话题不存在' });
        }

        await prisma.topic.delete({ where: { id } });

        return { success: true };
      } catch (error) {
        throw error;
      }
    },
  });

  fastify.post('/:id/notes', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { id } = request.params as { id: string };
        const data = createNoteSchema.parse(request.body);

        const existing = await prisma.topic.findFirst({ where: { id, userId } });
        if (!existing) {
          return reply.code(404).send({ error: '话题不存在' });
        }

        const note = await prisma.topicNote.create({
          data: {
            topicId: id,
            userId,
            content: data.content,
            noteType: data.noteType,
          },
        });

        return { note };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: '请求参数错误', details: error.errors });
        }
        throw error;
      }
    },
  });

  fastify.delete('/:topicId/notes/:noteId', {
    onRequest: [fastify.authenticate],
    handler: async (request, reply) => {
      try {
        const userId = request.user.userId;
        const { topicId, noteId } = request.params as { topicId: string; noteId: string };

        const note = await prisma.topicNote.findFirst({
          where: { id: noteId, topicId, userId },
        });

        if (!note) {
          return reply.code(404).send({ error: '笔记不存在' });
        }

        await prisma.topicNote.delete({ where: { id: noteId } });

        return { success: true };
      } catch (error) {
        throw error;
      }
    },
  });
};
