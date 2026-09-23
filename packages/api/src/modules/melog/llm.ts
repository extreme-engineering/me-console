import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

/**
 * LLM 技能运行器（v0.3，可选）。
 *
 * 通过环境变量配置一个 OpenAI chat completions 兼容端点（OpenAI / DeepSeek /
 * 通义兼容模式 / Moonshot / 本地 Ollama 等），技能即可用模型生成报告：
 *   MELOG_LLM_BASE_URL  如 https://api.deepseek.com/v1 或 http://127.0.0.1:11434/v1
 *   MELOG_LLM_API_KEY   本地服务可填任意非空值
 *   MELOG_LLM_MODEL     如 deepseek-chat / qwen-plus / llama3
 *
 * 隐私：条目数据只会发送到用户自己配置的端点；未配置时技能自动走规则引擎。
 */

const providerSchema = z.object({
  baseUrl: z.string().regex(/^https?:\/\//, 'MELOG_LLM_BASE_URL 仅支持 http/https'),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

export interface LlmProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getLlmProvider(): LlmProvider | null {
  const { MELOG_LLM_BASE_URL, MELOG_LLM_API_KEY, MELOG_LLM_MODEL } = process.env;
  if (!MELOG_LLM_BASE_URL || !MELOG_LLM_API_KEY || !MELOG_LLM_MODEL) return null;
  const parsed = providerSchema.safeParse({
    baseUrl: MELOG_LLM_BASE_URL,
    apiKey: MELOG_LLM_API_KEY,
    model: MELOG_LLM_MODEL,
  });
  return parsed.success ? parsed.data : null;
}

export function isLlmConfigured(): boolean {
  return getLlmProvider() !== null;
}

// ==================== 上下文收集 ====================

const MAX_CONTENT = 400;
const MAX_PAYLOAD = 240;

/** 可调参数（环境变量，均有兜底默认值） */
function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.round(raw), min), max);
}

export function llmTimeoutMs(): number {
  return envInt('MELOG_LLM_TIMEOUT_MS', 60_000, 1_000, 600_000);
}

export function llmMaxEntries(): number {
  return envInt('MELOG_LLM_MAX_ENTRIES', 200, 10, 1_000);
}

export interface SkillContextEntry {
  id: string;
  day: string;
  category: string;
  type: string;
  title: string;
  actor?: string;
  tags?: string;
  content?: string;
  payload?: string;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 把统计区间内的条目压缩成适合放进 prompt 的紧凑 JSON（最新 200 条，字段截断） */
export async function gatherContextData(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ entries: SkillContextEntry[]; total: number }> {
  const all = await prisma.meLogEntry.findMany({
    where: { userId, occurredAt: { gte: periodStart, lte: periodEnd } },
    orderBy: { occurredAt: 'asc' },
  });
  const recent = all.slice(-llmMaxEntries());
  return {
    total: all.length,
    entries: recent.map((entry) => ({
      id: entry.id,
      day: dayKey(entry.occurredAt),
      category: entry.category,
      type: entry.type,
      title: entry.title,
      ...(entry.actor ? { actor: entry.actor } : {}),
      ...(entry.tags ? { tags: entry.tags } : {}),
      ...(entry.content ? { content: entry.content.slice(0, MAX_CONTENT) } : {}),
      ...(entry.payload ? { payload: entry.payload.slice(0, MAX_PAYLOAD) } : {}),
    })),
  };
}

// ==================== Prompt ====================

const SKILL_INSTRUCTIONS: Record<string, string> = {
  'health-insight': `你在分析用户的健康数据（睡眠/运动/心率等）与聊天记录中的情绪表达。输出结构：
### 身体指标
### 情绪信号
### 压力提示（找出"情绪偏负面 + 睡眠不足"叠加的日子）
### 建议
给出 3-5 条具体、可执行的建议，语气克制，不要渲染焦虑。`,
  'knowledge-recall': `你在帮用户回顾一段时间内的笔记，并关联聊天中的相关讨论。输出结构：
### 主题关键词（提炼 5-10 个）
### 笔记重点（按主题归纳，不要流水账罗列）
### 相关讨论（笔记主题与聊天记录的关联）
### 下一步（值得深挖或行动的方向）`,
  'life-recap': `你在帮用户把一段时间的生活整理成复盘报告。输出结构：
### 概览（一句话总结这段时间的状态）
### 按天回顾（每天 2-4 行：沟通、健康、笔记的要点）
### 值得记住的（亮点、转折、被忽略的事）
### 下周期建议`,
};

const SYSTEM_PROMPT = `你是 MeLog（个人生活数据系统）的技能运行器。用户会给你一段时间内的个人生活数据（JSON），你生成一份中文 Markdown 复盘/洞察报告。
要求：
- 只依据给出的数据，不编造数据里没有的事实；数据不足的板块明确说"数据不足"
- 第一行写一行简短摘要（不超过 40 字，不带 markdown 符号），之后空一行再写正文
- 结构清晰、克制、面向行动，避免空话`;

export function buildSkillPrompt(input: {
  slug: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  data: { entries: SkillContextEntry[]; total: number };
}): { system: string; user: string } {
  const instruction = SKILL_INSTRUCTIONS[input.slug] || '按数据生成一份有洞察的中文 Markdown 报告。';
  const user = [
    `技能：${input.name}（${input.slug}）`,
    `统计区间：${dayKey(input.periodStart)} ~ ${dayKey(input.periodEnd)}`,
    `数据条数：${input.data.total}（最多展示 ${input.data.entries.length} 条）`,
    '',
    '数据（JSON）：',
    // 内部条目 ID 不进入 prompt
    JSON.stringify(input.data.entries.map(({ id: _id, ...entry }) => entry)),
    '',
    '专项要求：',
    instruction,
  ].join('\n');
  return { system: SYSTEM_PROMPT, user };
}

// ==================== 调用 ====================

export interface LlmReport {
  summary: string;
  result: string;
  model: string;
}

export interface GenerateLlmReportOptions {
  userId: string;
  slug: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  /** 已收集好的上下文；不传则自动从时间线收集 */
  context?: { entries: SkillContextEntry[]; total: number };
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** 调用 LLM 生成报告；失败抛错，由调用方决定回退策略。 */
export async function generateLlmReport(options: GenerateLlmReportOptions): Promise<LlmReport> {
  const provider = getLlmProvider();
  if (!provider) throw new Error('LLM 未配置（需要 MELOG_LLM_BASE_URL / MELOG_LLM_API_KEY / MELOG_LLM_MODEL）');

  const data =
    options.context || (await gatherContextData(options.userId, options.periodStart, options.periodEnd));
  const prompt = buildSkillPrompt({
    slug: options.slug,
    name: options.name,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    data,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? llmTimeoutMs());
  try {
    const fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
    const response = await fetchImpl(`${provider.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LLM 端点返回 HTTP ${response.status}：${text.slice(0, 200)}`);
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('LLM 返回内容为空');

    const [firstLine, ...rest] = content.split('\n');
    const summarySource = rest.length > 0 ? firstLine : content.slice(0, 60);
    const summary = summarySource.replace(/^[#\s>*-]+/, '').slice(0, 80);
    return {
      summary: summary || `LLM 生成（${provider.model}）`,
      result: content,
      model: provider.model,
    };
  } finally {
    clearTimeout(timer);
  }
}
