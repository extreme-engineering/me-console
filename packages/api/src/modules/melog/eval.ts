/* eslint-disable no-console */
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { executeSkill } from './service.js';
import { gatherContextData, isLlmConfigured } from './llm.js';

/**
 * MeLog LLM 技能评测脚本（需要先配置 MELOG_LLM_* 环境变量并准备本地数据）。
 *
 * 用法（在 packages/api 下）：
 *   MELOG_LLM_BASE_URL=… MELOG_LLM_API_KEY=… MELOG_LLM_MODEL=… \
 *   npx tsx src/modules/melog/eval.ts --slug life-recap --days 7
 *
 * 输出：报告全文 + 简单的接地指标（数据天覆盖率、分类提及、延迟），
 * 报告与指标写入 ~/.melog/evals/ 以便跨模型对比。
 *
 * 指标说明：coverage 低说明模型忽略了大部分日期的数据（欠覆盖）；
 * 结合人工抽查报告里是否出现数据之外的断言（幻觉）。
 */

interface Args {
  slug: string;
  days: number;
  userId: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { slug: 'life-recap', days: 7, userId: 'mock-user-1' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--slug') args.slug = argv[++i];
    else if (argv[i] === '--days') args.days = Number(argv[++i]) || 7;
    else if (argv[i] === '--user') args.userId = argv[++i];
  }
  return args;
}

async function main(): Promise<number> {
  const { slug, days, userId } = parseArgs(process.argv.slice(2));

  if (!isLlmConfigured()) {
    console.error('未配置 LLM：请设置 MELOG_LLM_BASE_URL / MELOG_LLM_API_KEY / MELOG_LLM_MODEL');
    return 1;
  }

  const end = new Date();
  const start = new Date(end.getTime() - days * 86400e3);
  const context = await gatherContextData(userId, start, end);
  const dataDays = [...new Set(context.entries.map((e) => e.day))];
  const dataCategories = [...new Set(context.entries.map((e) => e.category))];

  console.log(
    `评测配置：slug=${slug} 区间=${start.toISOString()} ~ ${end.toISOString()} 数据 ${context.total} 条 / ${dataDays.length} 天（送入 ${context.entries.length} 条）`,
  );
  if (context.entries.length === 0) {
    console.error('统计区间内没有数据，先跑连接器或 ingest 再评测');
    return 1;
  }

  const startedAt = Date.now();
  const { run, result } = await executeSkill(userId, slug, days);
  const latencyMs = Date.now() - startedAt;

  const mentionedDays = dataDays.filter((day) => result.includes(day));
  const coverage = dataDays.length > 0 ? mentionedDays.length / dataDays.length : 0;
  const categoryLabels: Record<string, string> = {
    health: '健康|睡眠|步数|心率|体重|运动',
    note: '笔记|知识',
    im: '沟通|聊天|对话',
    media: '媒体',
    location: '足迹',
    custom: '其他',
  };
  const mentionedCategories = dataCategories.filter((category) =>
    (categoryLabels[category] || category).split('|').some((word) => result.includes(word)),
  );

  const stats = typeof run.stats === 'string' ? run.stats : '{}';
  const parsedStats = JSON.parse(stats || '{}') as { engine?: string; model?: string };
  const metrics = {
    slug,
    days,
    engine: parsedStats.engine,
    model: parsedStats.model,
    latencyMs,
    dataEntries: context.total,
    dataDays: dataDays.length,
    mentionedDays: mentionedDays.length,
    dayCoverage: Number(coverage.toFixed(2)),
    mentionedCategories,
    dataCategories,
  };

  console.log('\n===== 报告 =====\n');
  console.log(result);
  console.log('\n===== 指标 =====\n');
  console.log(JSON.stringify(metrics, null, 2));

  const dir = path.join(homedir(), '.melog', 'evals');
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${slug}.md`);
  await writeFile(file, `<!-- ${JSON.stringify(metrics)} -->\n\n${result}\n`, 'utf8');
  console.log(`\n已保存：${file}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`❌ ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
