import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getPaginationParams, createPaginatedResponse } from '@meos/shared';

const createSubscriptionSchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1),
  billingCycle: z.enum(['monthly', 'yearly', 'quarterly']),
  costPerCycle: z.number().min(0),
  currency: z.string().default('USD'),
  startDate: z.string(),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
  autoRenew: z.boolean().default(false),
  websiteUrl: z.string().optional(),
  notes: z.string().optional(),
  config: z.record(z.any()).optional(),
});

const updateSubscriptionSchema = createSubscriptionSchema.partial();

const createQuotaSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  monthlyLimit: z.number().min(0),
  warningThreshold: z.number().min(0).max(1).default(0.8),
  criticalThreshold: z.number().min(0).max(1).default(0.95),
  order: z.number().int().default(0),
  quotaType: z.enum(['consumable', 'renewable']).default('consumable'),
});

const updateQuotaSchema = createQuotaSchema.partial();

const recordUsageSchema = z.object({
  notes: z.string().optional(),
  quotaUsages: z.array(z.object({
    quotaDefinitionId: z.string(),
    usedAmount: z.number().min(0),
  })),
});

export const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  const auth = { onRequest: [fastify.authenticate] };

  fastify.post('/', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const data = createSubscriptionSchema.parse(request.body);

      const subscription = await prisma.subscription.create({
        data: {
          name: data.name,
          provider: data.provider,
          billingCycle: data.billingCycle,
          costPerCycle: data.costPerCycle,
          currency: data.currency,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          userId,
        },
      });

      return { subscription };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.get('/', auth, async (request, _reply) => {
    try {
      const userId = request.user.userId;
      const { page, pageSize, limit = 50, offset = 0 } = request.query as {
        page?: number; pageSize?: number; limit?: number; offset?: number;
      };

      const { take, skip } = getPaginationParams({ page, pageSize, limit, offset });

      const [subscriptions, total] = await Promise.all([
        prisma.subscription.findMany({
          where: { userId },
          include: { quotas: { orderBy: { order: 'asc' } } },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.subscription.count({ where: { userId } }),
      ]);

      return createPaginatedResponse(subscriptions, total, { page, pageSize, limit, offset });
    } catch (error) {
      throw error;
    }
  });

  fastify.get('/dashboard/summary', auth, async (request, _reply) => {
    try {
      const userId = request.user.userId;

      const subscriptions = await prisma.subscription.findMany({
        where: { userId, isActive: true },
        include: { quotas: { orderBy: { order: 'asc' } } },
      });

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const subscriptionIds = subscriptions.map((s) => s.id);

      const allUsages = subscriptionIds.length > 0
        ? await prisma.monthlyUsage.findMany({
            where: {
              subscriptionId: { in: subscriptionIds },
              year: currentYear,
              month: currentMonth,
            },
            include: { quotaUsages: true },
          })
        : [];

      const usageMap = new Map(allUsages.map((u) => [u.subscriptionId, u]));

      const summary = subscriptions.map((sub) => {
        const currentUsage = usageMap.get(sub.id);

        let monthlyCost = sub.costPerCycle;
        if (sub.billingCycle === 'yearly') monthlyCost = sub.costPerCycle / 12;
        else if (sub.billingCycle === 'quarterly') monthlyCost = sub.costPerCycle / 3;

        const quotaUtilization = sub.quotas.map((quota) => {
          const usage = currentUsage?.quotaUsages.find(
            (u) => u.quotaDefinitionId === quota.id
          );
          const used = usage?.usedAmount || 0;
          const util = quota.monthlyLimit > 0 ? used / quota.monthlyLimit : 0;

          let status: 'ok' | 'warning' | 'critical' = 'ok';
          if (util >= quota.criticalThreshold) status = 'critical';
          else if (util >= quota.warningThreshold) status = 'warning';

          return {
            id: quota.id,
            name: quota.name,
            unit: quota.unit,
            used,
            limit: quota.monthlyLimit,
            utilization: util,
            status,
          };
        });

        const overallUtilization =
          quotaUtilization.length > 0
            ? quotaUtilization.reduce((sum, u) => sum + u.utilization, 0) / quotaUtilization.length
            : 0;

        const startDate = new Date(sub.startDate);
        let daysUntilRenewal = 30;
        if (sub.billingCycle === 'yearly') {
          daysUntilRenewal = Math.max(0, 365 - Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) % 365);
        } else if (sub.billingCycle === 'quarterly') {
          daysUntilRenewal = Math.max(0, 90 - Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) % 90);
        }

        return {
          id: sub.id,
          name: sub.name,
          provider: sub.provider,
          monthlyCost,
          currency: sub.currency,
          overallUtilization,
          quotaUtilization,
          daysUntilRenewal,
          isActive: sub.isActive,
          autoRenew: sub.autoRenew,
        };
      });

      const totalMonthlySpend = summary.reduce((sum, s) => sum + s.monthlyCost, 0);
      const nearLimitCount = summary.filter((s) => s.quotaUtilization.some((q) => q.status === 'warning' || q.status === 'critical')).length;
      const criticalCount = summary.filter((s) => s.quotaUtilization.some((q) => q.status === 'critical')).length;

      return {
        subscriptions: summary,
        stats: {
          totalMonthlySpend,
          activeCount: summary.length,
          nearLimitCount,
          criticalCount,
        },
      };
    } catch (error) {
      throw error;
    }
  });

  fastify.get('/:id', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };

      const subscription = await prisma.subscription.findFirst({
        where: { id, userId },
        include: { quotas: { orderBy: { order: 'asc' } } },
      });

      if (!subscription) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      const now = new Date();
      const currentUsage = await prisma.monthlyUsage.findUnique({
        where: {
          subscriptionId_year_month: {
            subscriptionId: id,
            year: now.getFullYear(),
            month: now.getMonth() + 1,
          },
        },
        include: { quotaUsages: true },
      });

      return { subscription, currentUsage };
    } catch (error) {
      throw error;
    }
  });

  fastify.patch('/:id', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = updateSubscriptionSchema.parse(request.body);

      const existing = await prisma.subscription.findFirst({ where: { id, userId } });
      if (!existing) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      const updateData: Prisma.SubscriptionUpdateInput = { ...data };
      if (data.startDate) updateData.startDate = new Date(data.startDate);
      if (data.endDate) updateData.endDate = new Date(data.endDate);

      const subscription = await prisma.subscription.update({ where: { id }, data: updateData });
      return { subscription };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.delete('/:id', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };

      const existing = await prisma.subscription.findFirst({ where: { id, userId } });
      if (!existing) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      await prisma.subscription.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  fastify.post('/:id/quotas', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const data = createQuotaSchema.parse(request.body);

      const subscription = await prisma.subscription.findFirst({ where: { id, userId } });
      if (!subscription) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      const quota = await prisma.quotaDefinition.create({ data: { ...data, subscriptionId: id } });
      return { quota };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.patch('/:id/quotas/:quotaId', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id, quotaId } = request.params as { id: string; quotaId: string };
      const data = updateQuotaSchema.parse(request.body);

      const subscription = await prisma.subscription.findFirst({ where: { id, userId } });
      if (!subscription) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      const quota = await prisma.quotaDefinition.update({ where: { id: quotaId }, data });
      return { quota };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.delete('/:id/quotas/:quotaId', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id, quotaId } = request.params as { id: string; quotaId: string };

      const subscription = await prisma.subscription.findFirst({ where: { id, userId } });
      if (!subscription) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      await prisma.quotaDefinition.delete({ where: { id: quotaId } });
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  fastify.post('/:id/usage/:year/:month', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id, year, month } = request.params as { id: string; year: string; month: string };
      const data = recordUsageSchema.parse(request.body);

      const subscription = await prisma.subscription.findFirst({ where: { id, userId } });
      if (!subscription) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      const yearNum = parseInt(year);
      const monthNum = parseInt(month);

      const monthlyUsage = await prisma.monthlyUsage.upsert({
        where: { subscriptionId_year_month: { subscriptionId: id, year: yearNum, month: monthNum } },
        create: { subscriptionId: id, year: yearNum, month: monthNum, notes: data.notes },
        update: { notes: data.notes, recordedAt: new Date() },
        include: { quotaUsages: true },
      });

      for (const qUsage of data.quotaUsages) {
        await prisma.quotaUsage.upsert({
          where: { monthlyUsageId_quotaDefinitionId: { monthlyUsageId: monthlyUsage.id, quotaDefinitionId: qUsage.quotaDefinitionId } },
          create: { monthlyUsageId: monthlyUsage.id, quotaDefinitionId: qUsage.quotaDefinitionId, usedAmount: qUsage.usedAmount },
          update: { usedAmount: qUsage.usedAmount },
        });
      }

      const updated = await prisma.monthlyUsage.findUnique({
        where: { id: monthlyUsage.id },
        include: { quotaUsages: true },
      });

      return { monthlyUsage: updated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: '请求参数错误', details: error.errors });
      }
      throw error;
    }
  });

  fastify.get('/:id/usage/:year/:month', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id, year, month } = request.params as { id: string; year: string; month: string };

      const subscription = await prisma.subscription.findFirst({ where: { id, userId } });
      if (!subscription) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      const monthlyUsage = await prisma.monthlyUsage.findUnique({
        where: { subscriptionId_year_month: { subscriptionId: id, year: parseInt(year), month: parseInt(month) } },
        include: { quotaUsages: { include: { quotaDefinition: true } } },
      });

      return { monthlyUsage };
    } catch (error) {
      throw error;
    }
  });

  fastify.get('/:id/usage', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };
      const { limit = 12, offset = 0 } = request.query as { limit?: number; offset?: number };

      const subscription = await prisma.subscription.findFirst({ where: { id, userId } });
      if (!subscription) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      const [usageRecords, total] = await Promise.all([
        prisma.monthlyUsage.findMany({
          where: { subscriptionId: id },
          include: { quotaUsages: { include: { quotaDefinition: true } } },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.monthlyUsage.count({ where: { subscriptionId: id } }),
      ]);

      return { usageRecords, total };
    } catch (error) {
      throw error;
    }
  });

  fastify.get('/:id/usage/current', auth, async (request, reply) => {
    try {
      const userId = request.user.userId;
      const { id } = request.params as { id: string };

      const subscription = await prisma.subscription.findFirst({ where: { id, userId }, include: { quotas: true } });
      if (!subscription) {
        return reply.code(404).send({ error: '订阅不存在' });
      }

      const now = new Date();
      const currentUsage = await prisma.monthlyUsage.findUnique({
        where: { subscriptionId_year_month: { subscriptionId: id, year: now.getFullYear(), month: now.getMonth() + 1 } },
        include: { quotaUsages: { include: { quotaDefinition: true } } },
      });

      const utilization = subscription.quotas.map((quota) => {
        const usage = currentUsage?.quotaUsages.find((u) => u.quotaDefinitionId === quota.id);
        const used = usage?.usedAmount || 0;
        const util = quota.monthlyLimit > 0 ? used / quota.monthlyLimit : 0;
        let status: 'ok' | 'warning' | 'critical' = 'ok';
        if (util >= quota.criticalThreshold) status = 'critical';
        else if (util >= quota.warningThreshold) status = 'warning';
        return { quotaId: quota.id, name: quota.name, unit: quota.unit, used, limit: quota.monthlyLimit, utilization: util, status };
      });

      const overallUtilization = utilization.length > 0 ? utilization.reduce((sum, u) => sum + u.utilization, 0) / utilization.length : 0;

      return { subscriptionId: id, year: now.getFullYear(), month: now.getMonth() + 1, utilization, overallUtilization };
    } catch (error) {
      throw error;
    }
  });
};
