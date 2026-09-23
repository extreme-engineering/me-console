import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildSkillPrompt, generateLlmReport, getLlmProvider, isLlmConfigured, llmMaxEntries, llmTimeoutMs } from './llm.js';

const ENV_KEYS = ['MELOG_LLM_BASE_URL', 'MELOG_LLM_API_KEY', 'MELOG_LLM_MODEL'] as const;

function setProviderEnv(baseUrl = 'http://127.0.0.1:9/v1') {
  process.env.MELOG_LLM_BASE_URL = baseUrl;
  process.env.MELOG_LLM_API_KEY = 'test-key';
  process.env.MELOG_LLM_MODEL = 'test-model';
}

let savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
});

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] !== undefined) process.env[key] = savedEnv[key];
  }
});

describe('LLM 运行器', () => {
  it('should report provider only when all env vars are valid', () => {
    expect(isLlmConfigured()).toBe(false);

    process.env.MELOG_LLM_BASE_URL = 'ftp://bad.example.com';
    process.env.MELOG_LLM_API_KEY = 'k';
    process.env.MELOG_LLM_MODEL = 'm';
    expect(getLlmProvider()).toBeNull();

    setProviderEnv();
    expect(isLlmConfigured()).toBe(true);
    expect(getLlmProvider()?.model).toBe('test-model');
  });

  it('should build prompts without internal entry ids', () => {
    setProviderEnv();
    const prompt = buildSkillPrompt({
      slug: 'life-recap',
      name: '生活复盘',
      periodStart: new Date('2026-09-01T00:00:00Z'),
      periodEnd: new Date('2026-09-03T00:00:00Z'),
      data: {
        total: 2,
        entries: [
          { id: 'entry-1', day: '2026-09-01', category: 'im', type: 'chat-message', title: '对话', content: '内容' },
          { id: 'entry-2', day: '2026-09-02', category: 'health', type: 'sleep', title: '睡眠 7 小时' },
        ],
      },
    });

    expect(prompt.system).toContain('MeLog');
    expect(prompt.user).toContain('2026-09-01 ~ 2026-09-03');
    expect(prompt.user).toContain('"category":"im"');
    expect(prompt.user).not.toContain('entry-1');
  });

  it('should generate a report via an OpenAI-compatible endpoint', async () => {
    setProviderEnv();
    let captured: { url: string; auth: string; body: { model?: string; messages?: unknown[] } } | null = null;

    const report = await generateLlmReport({
      userId: 'u',
      slug: 'life-recap',
      name: '生活复盘',
      periodStart: new Date('2026-09-01T00:00:00Z'),
      periodEnd: new Date('2026-09-03T00:00:00Z'),
      context: { total: 1, entries: [] },
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        captured = {
          url: String(url),
          auth: (init?.headers as Record<string, string>).Authorization,
          body: JSON.parse(String(init?.body)),
        };
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '## 生活复盘报告\n\n本周状态平稳。' } }] }),
          { status: 200 },
        );
      }) as typeof fetch,
    });

    expect(captured!.url).toBe('http://127.0.0.1:9/v1/chat/completions');
    expect(captured!.auth).toBe('Bearer test-key');
    expect(captured!.body.model).toBe('test-model');
    expect(captured!.body.messages).toHaveLength(2);
    expect(report.model).toBe('test-model');
    expect(report.result).toContain('## 生活复盘报告');
    expect(report.summary).toBe('生活复盘报告');
  });

  it('should throw with a clear message when the endpoint fails', async () => {
    setProviderEnv();
    await expect(
      generateLlmReport({
        userId: 'u',
        slug: 'life-recap',
        name: '生活复盘',
        periodStart: new Date('2026-09-01T00:00:00Z'),
        periodEnd: new Date('2026-09-03T00:00:00Z'),
        context: { total: 0, entries: [] },
        fetchImpl: (async () => new Response('{"error":"boom"}', { status: 500 })) as typeof fetch,
      }),
    ).rejects.toThrow(/HTTP 500/);
  });

  it('should throw when not configured', async () => {
    await expect(
      generateLlmReport({
        userId: 'u',
        slug: 'life-recap',
        name: '生活复盘',
        periodStart: new Date('2026-09-01T00:00:00Z'),
        periodEnd: new Date('2026-09-03T00:00:00Z'),
      }),
    ).rejects.toThrow(/LLM 未配置/);
  });

  it('should clamp configurable timeout and context knobs', () => {
    process.env.MELOG_LLM_MAX_ENTRIES = '5000';
    process.env.MELOG_LLM_TIMEOUT_MS = '10';
    expect(llmMaxEntries()).toBe(1000);
    expect(llmTimeoutMs()).toBe(1000);

    delete process.env.MELOG_LLM_MAX_ENTRIES;
    delete process.env.MELOG_LLM_TIMEOUT_MS;
    expect(llmMaxEntries()).toBe(200);
    expect(llmTimeoutMs()).toBe(60_000);
  });
});
