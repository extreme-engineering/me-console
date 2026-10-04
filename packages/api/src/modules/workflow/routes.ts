import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

const entityTypes = ['vision', 'goal', 'keyResult', 'todo', 'habit'] as const;

const createWorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

const createStepSchema = z.object({
  entityType: z.enum(entityTypes),
  entityId: z.string(),
  label: z.string().min(1),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  width: z.number().default(200),
  height: z.number().default(80),
});

const updateStepSchema = z.object({
  label: z.string().min(1).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const createConnectionSchema = z.object({
  sourceStepId: z.string(),
  targetStepId: z.string(),
  sourceHandle: z.string().default('bottom'),
  targetHandle: z.string().default('top'),
});

export const workflowRoutes: FastifyPluginAsync = async (fastify) => {
  // List workflows
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (request, _reply) => {
    try {
      const userId = request.user.userId;
      const workflows = await prisma.workflow.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { steps: true, connections: true } },
        },
      });
      return { workflows };
    } catch (error) {
      throw error;
    }
  });

  // Create workflow
  fastify.post('/', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const data = createWorkflowSchema.parse(request.body);

      const workflow = await prisma.workflow.create({
        data: { userId, name: data.name, description: data.description },
      });
      return { workflow };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  // Get workflow with steps and connections
  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };

      const workflow = await prisma.workflow.findFirst({
        where: { id, userId },
        include: {
          steps: true,
          connections: true,
        },
      });

      if (!workflow) {
        return reply.code(404).send({ error: '工作流不存在' });
      }

      return { workflow };
    } catch (error) {
      throw error;
    }
  });

  // Update workflow
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = updateWorkflowSchema.parse(request.body);

      const existing = await prisma.workflow.findFirst({ where: { id, userId } });
      if (!existing) {
        return reply.code(404).send({ error: '工作流不存在' });
      }

      const workflow = await prisma.workflow.update({
        where: { id },
        data,
      });
      return { workflow };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  // Delete workflow
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };

      const result = await prisma.workflow.deleteMany({ where: { id, userId } });
      if (result.count === 0) {
        return reply.code(404).send({ error: '工作流不存在' });
      }
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  // Add step
  fastify.post('/:id/steps', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = createStepSchema.parse(request.body);

      const workflow = await prisma.workflow.findFirst({ where: { id, userId } });
      if (!workflow) {
        return reply.code(404).send({ error: '工作流不存在' });
      }

      const step = await prisma.workflowStep.create({
        data: { workflowId: id, ...data },
      });
      return { step };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  // Update step
  fastify.patch('/:id/steps/:stepId', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id, stepId } = request.params as { id: string; stepId: string };
      const data = updateStepSchema.parse(request.body);

      const workflow = await prisma.workflow.findFirst({ where: { id, userId } });
      if (!workflow) {
        return reply.code(404).send({ error: '工作流不存在' });
      }

      const step = await prisma.workflowStep.update({
        where: { id: stepId, workflowId: id },
        data,
      });
      return { step };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  // Delete step
  fastify.delete('/:id/steps/:stepId', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id, stepId } = request.params as { id: string; stepId: string };

      const workflow = await prisma.workflow.findFirst({ where: { id, userId } });
      if (!workflow) {
        return reply.code(404).send({ error: '工作流不存在' });
      }

      await prisma.workflowStep.delete({ where: { id: stepId, workflowId: id } });
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  // Add connection
  fastify.post('/:id/connections', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = createConnectionSchema.parse(request.body);

      const workflow = await prisma.workflow.findFirst({ where: { id, userId } });
      if (!workflow) {
        return reply.code(404).send({ error: '工作流不存在' });
      }

      const connection = await prisma.workflowConnection.create({
        data: { workflowId: id, ...data },
      });
      return { connection };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  // Delete connection
  fastify.delete('/:id/connections/:connId', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id, connId } = request.params as { id: string; connId: string };

      const workflow = await prisma.workflow.findFirst({ where: { id, userId } });
      if (!workflow) {
        return reply.code(404).send({ error: '工作流不存在' });
      }

      await prisma.workflowConnection.delete({ where: { id: connId, workflowId: id } });
      return { success: true };
    } catch (error) {
      throw error;
    }
  });
};