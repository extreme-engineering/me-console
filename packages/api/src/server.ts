import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { authRoutes } from './modules/auth/routes.js';
import { domainRoutes } from './modules/domain/routes.js';
import { balanceWheelRoutes } from './modules/balance-wheel/routes.js';
import { reflectionRoutes } from './modules/reflection/routes.js';
import { reviewRoutes } from './modules/review/routes.js';
import { insightRoutes } from './modules/insight/routes.js';
import { subscriptionRoutes } from './modules/subscription/routes.js';
import { mindsetRoutes } from './modules/mindset/routes.js';
import { visionRoutes } from './modules/vision/routes.js';
import { goalRoutes } from './modules/goal/routes.js';
import { todoRoutes } from './modules/todo/routes.js';
import { habitRoutes } from './modules/habit/routes.js';
import { topicRoutes } from './modules/topic/routes.js';
import { readingRoutes } from './modules/reading/routes.js';
import { contactRoutes } from './modules/contact/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { opportunityRoutes } from './modules/opportunity/routes.js';
import { workflowRoutes } from './modules/workflow/routes.js';
import { melogRoutes } from './modules/melog/routes.js';
import { brandRoutes } from './modules/brand/routes.js';
import { startMelogScheduler } from './modules/melog/scheduler.js';
import { AuthenticatedUser } from '@meos/shared';
export type { AuthenticatedUser };

// 扩展 Fastify 类型
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}

const server = Fastify({
  logger: true,
});

const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  'http://localhost:3015,http://localhost:3000,http://localhost:5173,http://127.0.0.1:3015'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

await server.register(cors, {
  origin: (origin, cb) => {
    // 无 Origin 头（curl、同源、服务端调用）直接放行
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
});

await server.register(rateLimit, {
  global: true,
  max: Number(process.env.RATE_LIMIT_MAX) || 300,
  timeWindow: '1 minute',
});

await server.register(swagger, {
  openapi: {
    info: {
      title: 'MeOS API',
      description: '人生管理系统 API 文档',
      version: '0.1.0',
    },
    servers: [{ url: 'http://localhost:3001' }],
  },
});

await server.register(swaggerUi, {
  routePrefix: '/docs',
});

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET 环境变量未设置：生产环境必须配置强密钥');
    }
    server.log.warn('⚠️  JWT_SECRET 未设置，使用开发环境默认密钥，请勿在生产环境使用');
    return 'meos-dev-insecure-secret-change-me';
  }
  if (secret.length < 16 && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET 长度过短：生产环境密钥至少 16 个字符');
  }
  return secret;
}

await server.register(jwt, { secret: getJwtSecret() });

// 开发认证旁路：必须显式设置 MEOS_DEV_AUTH=true，不随 NODE_ENV 自动开启，
// 避免环境变量误配置导致鉴权整体失效
const devAuthBypass = process.env.MEOS_DEV_AUTH === 'true';
if (devAuthBypass) {
  server.log.warn('⚠️  开发认证旁路已启用：所有请求将以 mock-user-1 身份访问，请勿用于生产环境');
  // 旁路身份必须在 User 表真实存在，否则任何写库操作都会因外键约束（P2003）失败
  const { prisma } = await import('./lib/prisma.js');
  const { ensureBrandMockUser } = await import('./prisma/seed-brand.js');
  await ensureBrandMockUser(prisma);
}

server.decorate('authenticate', async function (request, reply) {
  if (devAuthBypass) {
    request.user = { userId: 'mock-user-1' };
    return;
  }
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: '认证失败' });
  }
});

// 全局错误处理
server.setErrorHandler((error, _request, reply) => {
  server.log.error(error);
  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? '服务器内部错误' : (error.message || '请求处理失败');
  reply.code(statusCode).send({ error: message });
});

server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// 方向 (Direction)
server.register(visionRoutes, { prefix: '/api/visions' });
server.register(domainRoutes, { prefix: '/api/domains' });
server.register(goalRoutes, { prefix: '/api/goals' });
server.register(mindsetRoutes, { prefix: '/api/mindsets' });
server.register(balanceWheelRoutes, { prefix: '/api/balance-wheel' });
server.register(workflowRoutes, { prefix: '/api/workflows' });

// 行动 (Action)
server.register(todoRoutes, { prefix: '/api/todos' });
server.register(habitRoutes, { prefix: '/api/habits' });

// 认知 (Cognition)
server.register(topicRoutes, { prefix: '/api/topics' });
server.register(insightRoutes, { prefix: '/api/insights' });
server.register(readingRoutes, { prefix: '/api/reading' });

// 反思 (Reflection)
server.register(reflectionRoutes, { prefix: '/api/reflections' });
server.register(reviewRoutes, { prefix: '/api/reviews' });

// 资源 (Resources)
server.register(subscriptionRoutes, { prefix: '/api/subscriptions' });
server.register(contactRoutes, { prefix: '/api/contacts' });
server.register(healthRoutes, { prefix: '/api/health' });
server.register(opportunityRoutes, { prefix: '/api/opportunities' });

// MeLog (生活数据汇聚)
server.register(melogRoutes, { prefix: '/api/melog' });

server.register(brandRoutes, { prefix: '/api/brand' });

// 认证
server.register(authRoutes, { prefix: '/api/auth' });

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3001;
    // 默认只绑定回环地址，避免开发后端暴露到局域网；需要外部访问时设 MEOS_HOST
    const host = process.env.MEOS_HOST || '127.0.0.1';
    startMelogScheduler();
    await server.listen({ port, host });
    server.log.info(`Server running at http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
