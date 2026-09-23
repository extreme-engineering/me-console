#!/usr/bin/env node
import { createReadStream, stat } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { MeLogIngestClient, type MeLogEntryCategory } from './lib/ingest.js';
import { BrandApiClient } from './lib/brand-client.js';
import { loadState, resolveStateDir, saveState } from './lib/state.js';
import { aggregateDaily, parseAppleHealthExport } from './connectors/apple-health.js';
import { runChatlogConnector } from './connectors/chatlog.js';
import { runTextlogConnector } from './connectors/textlog.js';
import { collectDida365Entries, runDida365Connector } from './connectors/dida365.js';
import { buildSpeakEntries, parseMetrics } from './connectors/speak.js';
import { runBilibiliConnector } from './connectors/bilibili.js';
import { runYouTubeConnector } from './connectors/youtube.js';
import { runGitHubConnector } from './connectors/github.js';
import { runImportConnector } from './connectors/import.js';

/**
 * melog-connector — MeLog 官方连接器 CLI。
 *
 * 用法：
 *   melog-connector chatlog       [--chatlog-url http://127.0.0.1:5030] [--talkers wxid_a,wxid_b]
 *                                 [--days 3] [--source-name 微信聊天记录]
 *   melog-connector apple-health  --export ~/Downloads/export.zip [--days 30] [--source-name Apple 健康]
 *   melog-connector dida365       [--days 30] [--token <t>] [--no-habits] [--no-tasks]
 *                                 [--api-base https://api.dida365.com] [--dry-run]
 *   melog-connector speak         --text "今天 8500 步，睡眠 6 小时 40 分" [--date YYYY-MM-DD]
 *   melog-connector brand-bilibili --mid <mid> [--channel-id <id>] [--max-videos 100]
 *                                 [--cookie <cookie>] [--dry-run]
 *   melog-connector brand-youtube --channel-id <UCxxx> [--channel-id <id>] [--max-videos 50]
 *                                 [--api-key <key>] [--dry-run]
 *   melog-connector brand-github --repo <owner/name> [--channel-id <id>] [--token <pat>] [--dry-run]
 *   melog-connector brand-import --file <path.json> [--target-channel-id <id>] [--dry-run]
 *
 * 通用选项：
 *   --meos-url http://localhost:3001   MeOS API 地址
 *   --token <token>                    Bearer Token（也可用环境变量 MEOS_API_TOKEN）
 *   --state-dir <dir>                  状态目录（默认 ~/.melog/connectors）
 */

interface Args {
  command: string;
  flags: Record<string, string>;
}

function parseArgs(argv: string[]): Args {
  const [command = '', ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
      flags[key] = value;
    }
  }
  return { command, flags };
}

function statFile(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    stat(path, (error, stats) => resolve(!error && stats.isFile()));
  });
}

async function resolveExportEntry(exportPath: string): Promise<string | null> {
  const lister = spawn('unzip', ['-Z1', '--', exportPath], { stdio: ['ignore', 'pipe', 'inherit'] });
  let listing = '';
  lister.stdout.on('data', (chunk: Buffer) => (listing += chunk.toString()));
  const code = await new Promise<number | null>((resolve) => lister.on('close', resolve));
  if (code !== 0) return null;
  return (
    listing
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.toLowerCase().endsWith('export.xml')) || null
  );
}

async function openExportStream(exportPath: string): Promise<NodeJS.ReadableStream> {
  if (!exportPath.toLowerCase().endsWith('.zip')) {
    return createReadStream(exportPath, { encoding: 'utf8' });
  }
  // Apple 健康导出 zip 里的 export.xml 位于语言相关的目录（如 “Apple Health Data/”）
  const entry = await resolveExportEntry(exportPath);
  if (!entry) {
    throw new Error('无法读取 zip 或其中没有 export.xml；可手动解压后用 --export 指向 export.xml');
  }
  const extractor = spawn('unzip', ['-p', '--', exportPath, entry], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return extractor.stdout;
}

// ==================== brand-* 快照命令的公共渲染 ====================

function makeBrandClient(flags: Record<string, string>): BrandApiClient {
  return new BrandApiClient({
    apiUrl: flags['meos-url'] || 'http://localhost:3001',
    token: flags.token || process.env.MEOS_API_TOKEN,
  });
}

const fmtIncrement = (n: number | null) => (n === null ? '—' : String(n));
const baselineSuffix = (baseline: boolean) => (baseline ? '（首次基线）' : '');

/** 品牌快照命令统一输出：header + 摘要行 + dry-run/写入结果行 */
function printBrandOutcome(opts: {
  header: string;
  summary: string[];
  channelId: string | null;
  dryRun: boolean;
}): void {
  console.log(
    [
      opts.header,
      ...opts.summary,
      opts.dryRun ? '--dry-run：未写入快照' : `✅ 快照已写入 MeOS（渠道 ${opts.channelId}）`,
    ].join('\n'),
  );
}

async function main(): Promise<number> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === 'help') {
    console.log(
      [
        'melog-connector — MeLog 官方连接器',
        '',
        '命令：',
        '  chatlog        同步 chatlog 兼容服务的聊天记录（⚠️ 使用前自行确认数据来源合法）',
        '  textlog        导入自己导出的聊天记录文件（txt / csv，✅ 合规路径，不解密不碰库）',
        '  apple-health   解析 Apple Health 导出（export.xml / export.zip）',
        '  dida365        同步滴答清单的习惯打卡与任务备注（Web 私有接口，Cookie t token）',
        '  speak          一句话口述录入健康指标（无 API 设备的半自动通道）',
        '  brand-bilibili 拉取 B站公开数据（粉丝/播放/点赞等）写入品牌快照',
        '  brand-youtube  拉取 YouTube Data API v3 数据（订阅/视频指标）写入品牌快照',
        '  brand-github   拉取 GitHub 仓库指标（stars/forks/issues）写入品牌快照',
        '  brand-import  从本地 JSON 文件读取指标（公众号/视频号/小红书等封闭平台手动采集）',
        '',
        '通用选项：',
        '  --meos-url <url>      MeOS API 地址（默认 http://localhost:3001）',
        '  --token <token>       Bearer Token（默认环境变量 MEOS_API_TOKEN）',
        '  --source-name <name>  数据源显示名',
        '  --days <n>            回溯天数',
        'chatlog 选项：  --chatlog-url <url>  --talkers <id,id>',
        'health 选项：   --export <path>（export.xml 或 export.zip）',
        'textlog 选项：  --file <path.txt|path.csv>  --csv  --me <我的名字>  --talker <会话名>',
        'dida365 选项：  --token <t>（默认环境变量 DIDA365_TOKEN）  --api-base <url>',
        '               --no-habits  --no-tasks  --dry-run',
        'speak 选项：    --text <一句话>  --date <YYYY-MM-DD>（默认今天）  --dry-run',
        'brand-bilibili 选项：--mid <mid>（space.bilibili.com/{mid}）  --channel-id <id>',
        '               --max-videos <n>  --cookie <cookie>（默认环境变量 BILIBILI_COOKIE）  --dry-run',
        'brand-youtube 选项： --channel-id <UCxxx>（YouTube 频道 ID）  --api-key <key>（默认 YOUTUBE_API_KEY）',
        '               --max-videos <n>  --target-channel-id <id>（目标 MeOS 渠道）  --dry-run',
        'brand-github 选项：  --repo <owner/name>  --token <pat>（默认 GITHUB_TOKEN，可选）',
        '               --target-channel-id <id>（目标 MeOS 渠道）  --dry-run',
        'brand-import 选项： --file <path.json>  --target-channel-id <id>  --dry-run',
      ].join('\n'),
    );
    return 0;
  }

  if (!['chatlog', 'textlog', 'apple-health', 'dida365', 'speak', 'brand-bilibili', 'brand-youtube', 'brand-github', 'brand-import'].includes(command)) {
    console.error(
      `未知命令：${command}（可用：chatlog / textlog / apple-health / dida365 / speak / brand-bilibili / brand-youtube / brand-github / brand-import）`,
    );
    return 1;
  }

  const client = new MeLogIngestClient({
    apiUrl: flags['meos-url'] || 'http://localhost:3001',
    token: flags.token || process.env.MEOS_API_TOKEN,
  });
  const stateDir = resolveStateDir(flags['state-dir']);
  const stateName = `cli-${command}`;

  if (command === 'apple-health') {
    const exportPath = flags.export;
    if (!exportPath || exportPath.startsWith('-')) {
      console.error('缺少 --export <export.xml|export.zip>（路径不能以 - 开头）');
      return 1;
    }
    if (!(await statFile(exportPath))) {
      console.error(`文件不存在：${exportPath}`);
      return 1;
    }

    console.log(`📦 解析 ${exportPath} …`);
    const records = await parseAppleHealthExport(await openExportStream(exportPath));
    const entries = aggregateDaily(records, { days: Number(flags.days || 30) });
    if (entries.length === 0) {
      console.log('窗口期内没有可导入的记录');
      return 0;
    }
    const result = await client.ingest(
      'apple-health',
      flags['source-name'] || 'Apple 健康',
      'health' as MeLogEntryCategory,
      entries,
    );
    await saveState(stateDir, stateName, { lastRunAt: new Date().toISOString(), ...result });
    console.log(`✅ Apple 健康：新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`);
    return 0;
  }

  if (command === 'textlog') {
    const filePath = flags.file;
    if (!filePath || filePath.startsWith('-')) {
      console.error('缺少 --file <path.txt|path.csv>（路径不能以 - 开头）');
      return 1;
    }
    if (!(await statFile(filePath))) {
      console.error(`文件不存在：${filePath}`);
      return 1;
    }
    const csv = flags.csv !== undefined || filePath.toLowerCase().endsWith('.csv');
    const content = await readFile(filePath, 'utf8');
    const result = await runTextlogConnector({
      content,
      csv,
      me: flags.me,
      talker: flags.talker,
      sourceName: flags['source-name'],
      client,
    });
    await saveState(stateDir, stateName, { lastRunAt: new Date().toISOString(), ...result });
    console.log(
      `✅ 聊天记录导入：解析 ${result.messages} 条，新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`,
    );
    return 0;
  }

  if (command === 'dida365') {
    const didaToken = flags.token || process.env.DIDA365_TOKEN;
    if (!didaToken) {
      console.error(
        [
          '缺少滴答清单 token：请登录 dida365.com 后，',
          '在 DevTools → Application → Cookies 中复制 `t` 的值，',
          '通过 --token <t> 或环境变量 DIDA365_TOKEN 传入。',
        ].join('\n'),
      );
      return 1;
    }
    const didaOptions = {
      token: didaToken,
      apiBase: flags['api-base'],
      sourceName: flags['source-name'],
      backfillDays: Number(flags.days || 30),
      includeHabits: !flags['no-habits'],
      includeTasks: !flags['no-tasks'],
    };

    console.log('📥 拉取滴答清单数据 …');
    if (flags['dry-run']) {
      const collected = await collectDida365Entries(didaOptions);
      console.log(
        [
          `--dry-run（不推送）：习惯 ${collected.habits} 个，打卡条目 ${collected.habitEntries.length} 条，备注条目 ${collected.taskEntries.length} 条`,
          `窗口：${collected.from} ~ ${collected.to}`,
        ].join('\n'),
      );
      for (const entry of [...collected.habitEntries.slice(0, 3), ...collected.taskEntries.slice(0, 3)]) {
        console.log(JSON.stringify(entry, null, 2));
      }
      return 0;
    }
    const result = await runDida365Connector({ ...didaOptions, client });
    await saveState(stateDir, stateName, { lastRunAt: new Date().toISOString(), ...result });
    console.log(
      `✅ 滴答清单：习惯 ${result.habits} 个，打卡 ${result.habitEntries.length} 条，备注 ${result.tasks} 条（窗口 ${result.from} ~ ${result.to}）；新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`,
    );
    return 0;
  }

  if (command === 'speak') {
    const text = flags.text;
    if (!text || text.startsWith('-')) {
      console.error('缺少 --text <一句话>，例如：--text "今天 8500 步，跑步 5 公里，睡眠 6 小时"');
      return 1;
    }
    const now = new Date();
    const dateKey =
      flags.date ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      console.error(`--date 格式应为 YYYY-MM-DD，收到：${dateKey}`);
      return 1;
    }

    const metrics = parseMetrics(text);
    const entries = buildSpeakEntries(text, dateKey);
    const summary = metrics
      .map((m) => `${m.raw}`)
      .join(' · ');
    console.log(
      `📝 ${dateKey}：解析到 ${metrics.length} 个指标${metrics.length > 0 ? `（${summary}）` : '，按原文 note 兜底保存'}`,
    );
    if (flags['dry-run']) {
      for (const entry of entries) {
        console.log(JSON.stringify(entry, null, 2));
      }
      return 0;
    }
    const grouped = new Map<string, typeof entries>();
    for (const entry of entries) {
      const category = entry.category;
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category)!.push(entry);
    }
    let created = 0;
    let updated = 0;
    for (const [category, group] of grouped) {
      const result = await client.ingest('melog-speak', '每日口述', category as MeLogEntryCategory, group);
      created += result.created;
      updated += result.updated;
    }
    await saveState(stateDir, stateName, { lastRunAt: new Date().toISOString(), dateKey });
    console.log(`✅ 口述录入：新增 ${created}，更新 ${updated}`);
    return 0;
  }

  if (command === 'brand-bilibili') {
    const mid = flags.mid;
    if (!mid) {
      console.error('缺少 --mid <mid>（B站用户 ID，见 space.bilibili.com/{mid}）');
      return 1;
    }
    const client = makeBrandClient(flags);
    const result = await runBilibiliConnector({
      mid,
      client,
      explicitChannelId: flags['channel-id'] || undefined,
      maxVideos: Number(flags['max-videos'] || 100),
      cookie: flags.cookie || process.env.BILIBILI_COOKIE,
      dryRun: flags['dry-run'] === 'true',
      stateDir,
      stateName: `brand-bilibili-${mid}`,
      loadState,
      saveState,
    });
    const totals = result.totals ?? { views: 0, likes: 0, comments: 0, shares: 0 };
    printBrandOutcome({
      header: '📥 拉取 B站公开数据（粉丝数 + 投稿统计）…',
      summary: [
        `账号：${result.author ?? mid} · 粉丝 ${result.follower} · 投稿 ${result.videoCount} 个`,
        `累计：播放 ${totals.views} · 点赞 ${totals.likes} · 评论 ${totals.comments} · 分享 ${totals.shares}`,
        `本周期增量：播放 ${fmtIncrement(result.increments.views)} · 点赞 ${fmtIncrement(result.increments.likes)} · 评论 ${fmtIncrement(result.increments.comments)} · 分享 ${fmtIncrement(result.increments.shares)} ${baselineSuffix(result.baseline)}`,
      ],
      channelId: result.channelId,
      dryRun: flags['dry-run'] === 'true',
    });
    return 0;
  }

if (command === 'brand-youtube') {
    const ytChannel = flags['channel-id'];
    if (!ytChannel) {
      console.error('缺少 --channel-id <UCxxx>（YouTube 频道 ID）');
      return 1;
    }
    const client = makeBrandClient(flags);
    const result = await runYouTubeConnector({
      channelId: ytChannel,
      apiKey: flags['api-key'] || process.env.YOUTUBE_API_KEY,
      client,
      explicitChannelId: flags['target-channel-id'],
      maxVideos: Number(flags['max-videos'] || 50),
      dryRun: flags['dry-run'] === 'true',
      stateDir,
      stateName: `brand-youtube-${ytChannel}`,
      loadState,
      saveState,
    });
    const totals = result.totals ?? { views: 0, likes: 0, comments: 0, shares: 0 };
    printBrandOutcome({
      header: '📥 拉取 YouTube Data API v3 数据…',
      summary: [
        `频道：${result.author ?? ytChannel} · 订阅 ${result.follower} · 视频 ${result.videoCount} 个`,
        `累计：观看 ${totals.views} · 点赞 ${totals.likes} · 评论 ${totals.comments} · 分享 ${totals.shares ?? '—'}`,
        `本周期增量：观看 ${fmtIncrement(result.increments.views)} · 点赞 ${fmtIncrement(result.increments.likes)} · 评论 ${fmtIncrement(result.increments.comments)} · 分享 — ${baselineSuffix(result.baseline)}`,
      ],
      channelId: result.channelId,
      dryRun: flags['dry-run'] === 'true',
    });
    return 0;
  }

if (command === 'brand-github') {
    const repo = flags.repo;
    if (!repo) {
      console.error('缺少 --repo <owner/name>');
      return 1;
    }
    const client = makeBrandClient(flags);
    const result = await runGitHubConnector({
      repo,
      token: flags.token || process.env.GITHUB_TOKEN,
      client,
      explicitChannelId: flags['target-channel-id'],
      dryRun: flags['dry-run'] === 'true',
      stateDir,
      stateName: `brand-github-${repo.replace(/[^A-Za-z0-9]/g, '_')}`,
      loadState,
      saveState,
    });
    const totals = result.totals ?? { views: null, likes: 0, comments: 0, shares: null };
    printBrandOutcome({
      header: '📥 拉取 GitHub 仓库指标…',
      summary: [
        `仓库：${result.fullName} · stars ${result.follower}`,
        `累计：forks ${totals.likes} · open issues ${totals.comments} · views/shares ${totals.views ?? '—'}`,
        `本周期增量：forks ${fmtIncrement(result.increments.likes)} · issues ${fmtIncrement(result.increments.comments)} · views ${totals.views ?? '—'} · shares ${totals.shares ?? '—'} ${baselineSuffix(result.baseline)}`,
      ],
      channelId: result.channelId,
      dryRun: flags['dry-run'] === 'true',
    });
    return 0;
  }

if (command === 'brand-import') {
    const filePath = flags.file;
    if (!filePath) {
      console.error('缺少 --file <path.json>（按统一 schema 组织数据，见 docs/实践/品牌/快照调度.md）');
      return 1;
    }
    const client = makeBrandClient(flags);
    const result = await runImportConnector({
      filePath,
      client,
      explicitChannelId: flags['target-channel-id'],
      dryRun: flags['dry-run'] === 'true',
      stateDir,
      stateName: `brand-import-${filePath.replace(/[^A-Za-z0-9]/g, '_')}`,
      loadState,
      saveState,
    });
    const totals = result.totals ?? { views: 0, likes: 0, comments: 0, shares: 0 };
    printBrandOutcome({
      header: `📥 从 ${filePath} 读取品牌快照…`,
      summary: [
        `渠道：${result.platform}/${result.handle}`,
        `粉丝：${result.follower}`,
        `累计：观看 ${totals.views} · 点赞 ${totals.likes} · 评论 ${totals.comments} · 分享 ${totals.shares}`,
        `本周期增量：观看 ${fmtIncrement(result.increments.views)} · 点赞 ${fmtIncrement(result.increments.likes)} · 评论 ${fmtIncrement(result.increments.comments)} · 分享 ${fmtIncrement(result.increments.shares)} ${baselineSuffix(result.baseline)}`,
      ],
      channelId: result.channelId,
      dryRun: flags['dry-run'] === 'true',
    });
    return 0;
  }

  // chatlog
  console.log('⚠️  chatlog 项目已因合规原因被上游移除；请自行确认本地数据来源合法，仅处理属于自己的记录。');
  const talkers = flags.talkers
    ? flags.talkers
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;
  const state = await loadState<{ lastRunAt?: string }>(stateDir, stateName, {});
  if (state.lastRunAt && !flags.days) {
    console.log(`上次同步：${state.lastRunAt}`);
  }
  const result = await runChatlogConnector({
    chatlogUrl: flags['chatlog-url'] || 'http://127.0.0.1:5030',
    client,
    sourceName: flags['source-name'],
    talkers,
    backfillDays: Number(flags.days || 3),
  });
  await saveState(stateDir, stateName, { lastRunAt: new Date().toISOString(), ...result });
  console.log(
    `✅ chatlog：${result.from} ~ ${result.to}，${result.talkers} 个会话，新增 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped}`,
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`❌ ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
