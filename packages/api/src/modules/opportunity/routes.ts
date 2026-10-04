import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const TRACKS = ['fde', 'meditation', 'trade'] as const;
const STAGES = ['lead', 'contacted', 'proposal', 'negotiation', 'won', 'delivered', 'lost'] as const;

const createOpportunitySchema = z.object({
  track: z.enum(TRACKS),
  title: z.string().min(1),
  stage: z.enum(STAGES).optional(),
  company: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  partner: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  link: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
});

const updateOpportunitySchema = z.object({
  track: z.enum(TRACKS).optional(),
  title: z.string().min(1).optional(),
  stage: z.enum(STAGES).optional(),
  company: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  partner: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  link: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  order: z.number().int().min(0).optional(),
});

export const opportunityRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request) => {
    const userId = request.user.userId;

    const opportunities = await prisma.opportunity.findMany({
      where: { userId },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });

    return { opportunities };
  });

  fastify.post('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const data = createOpportunitySchema.parse(request.body);

      const opportunity = await prisma.opportunity.create({
        data: {
          userId,
          track: data.track,
          title: data.title,
          stage: data.stage ?? 'lead',
          company: data.company,
          category: data.category,
          source: data.source,
          partner: data.partner,
          contact: data.contact,
          amount: data.amount,
          link: data.link,
          notes: data.notes,
          order: data.order ?? 0,
        },
      });

      return { opportunity };
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

    const opportunity = await prisma.opportunity.findFirst({
      where: { id, userId },
    });

    if (!opportunity) {
      return reply.code(404).send({ error: '商机不存在' });
    }

    return { opportunity };
  });

  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = updateOpportunitySchema.parse(request.body);

      const existing = await prisma.opportunity.findFirst({ where: { id, userId } });
      if (!existing) {
        return reply.code(404).send({ error: '商机不存在' });
      }

      const opportunity = await prisma.opportunity.update({
        where: { id },
        data,
      });

      return { opportunity };
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
    const userId = request.user.userId;
    const { id } = request.params as { id: string };

    const result = await prisma.opportunity.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return reply.code(404).send({ error: '商机不存在' });
    }

    return { success: true };
  });
};
