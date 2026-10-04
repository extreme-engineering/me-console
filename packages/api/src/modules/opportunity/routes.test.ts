import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildTestApp } from '../../test-utils.js';
import { opportunityRoutes } from './routes.js';

const prisma = new PrismaClient();
const USER_ID = 'opportunity-test-user';

async function cleanup() {
  await prisma.opportunity.deleteMany({ where: { userId: USER_ID } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
}

describe('Opportunity Routes', () => {
  beforeAll(async () => {
    await cleanup();
    await prisma.user.create({
      data: { id: USER_ID, email: 'opportunity-test@example.com', password: 'hashed', name: 'Opportunity Test' },
    });
  });

  beforeEach(async () => {
    await prisma.opportunity.deleteMany({ where: { userId: USER_ID } });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  async function createApp() {
    const app = await buildTestApp({ userId: USER_ID });
    await app.register(opportunityRoutes, { prefix: '/api/opportunities' });
    return app;
  }

  it('should create an opportunity with defaults', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: { track: 'meditation', title: '意定监护', company: '意安顿健康科技（重庆）有限公司' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.opportunity.title).toBe('意定监护');
    expect(body.opportunity.track).toBe('meditation');
    expect(body.opportunity.stage).toBe('lead');
    expect(body.opportunity.userId).toBe(USER_ID);
  });

  it('should reject invalid track', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: { track: 'unknown', title: 'X' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('请求参数错误');
  });

  it('should reject missing title', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: { track: 'trade' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should list opportunities of the user only', async () => {
    const app = await createApp();
    await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: { track: 'trade', title: '一带一路', stage: 'delivered' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: { track: 'fde', title: '洞察报告订阅' },
    });

    const response = await app.inject({ method: 'GET', url: '/api/opportunities' });
    expect(response.statusCode).toBe(200);
    const opportunities = response.json().opportunities;
    expect(opportunities).toHaveLength(2);
    expect(opportunities.map((o: { title: string }) => o.title).sort()).toEqual(['一带一路', '洞察报告订阅']);
  });

  it('should patch stage', async () => {
    const app = await createApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: { track: 'meditation', title: 'MOCICI 运营中心' },
    });
    const id = created.json().opportunity.id as string;

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/opportunities/${id}`,
      payload: { stage: 'delivered', link: 'https://lipetdojrb06.meoo.fun/read#/' },
    });

    expect(patched.statusCode).toBe(200);
    expect(patched.json().opportunity.stage).toBe('delivered');
    expect(patched.json().opportunity.link).toBe('https://lipetdojrb06.meoo.fun/read#/');
  });

  it('should 404 when patching another user\'s opportunity', async () => {
    const app = await createApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/opportunities/does-not-exist',
      payload: { stage: 'won' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('商机不存在');
  });

  it('should delete an opportunity', async () => {
    const app = await createApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/opportunities',
      payload: { track: 'fde', title: '临时商机' },
    });
    const id = created.json().opportunity.id as string;

    const deleted = await app.inject({ method: 'DELETE', url: `/api/opportunities/${id}` });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().success).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/api/opportunities' });
    expect(list.json().opportunities).toHaveLength(0);
  });
});
