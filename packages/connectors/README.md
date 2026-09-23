# @meos/melog-connectors — MeOS 官方连接器

把外部数据源按 [MeLog Standard](../../docs/实践/记录/标准.md) 推送到 MeOS 的统一时间线，
并把外部渠道（B站等）的指标数据按快照语义写入品牌板块。
零运行时依赖（Node.js 18+ 的全局 fetch），CLI 入口为 `melog-connector`。

## 连接器

| 命令 | 数据源 | 写入目标 | 说明 |
| --- | --- | --- | --- |
| `apple-health` | 健康 | MeLog | 解析 Apple Health 导出（export.xml / export.zip），按天聚合睡眠、步数、心率、体重、体能训练 |
| `chatlog` | IM（社区适配器） | MeLog | 调用 chatlog 兼容服务的 HTTP API，把消息按信封转换后推送 |
| `textlog` | IM（✅ 合规路径） | MeLog | 导入**用户自己导出的**聊天记录文件（txt / csv），纯文本解析，不碰任何应用数据库 |
| `dida365` | 待办/习惯 | MeLog | 拉取滴答清单的习惯打卡记录与任务备注，按信封转换后推送 |
| `brand-bilibili` | B站 | 品牌快照 | 拉取公开粉丝数与投稿统计，按 followers 累计 / views 等本周期增量写入 `MetricSnapshot` |
| `brand-youtube` | YouTube | 品牌快照 | Data API v3 拉订阅 + 视频统计（需 `YOUTUBE_API_KEY`） |
| `brand-github` | GitHub | 品牌快照 | 公开仓库 stars/forks/issues；无需鉴权，传 PAT 提高配额 |
| `brand-import` | 任意（封闭平台） | 品牌快照 | 从本地 JSON 文件读取指标（公众号/视频号/小红书等手动采集）；零外部依赖 |

> ⚠️ **chatlog 合规提示**：上游项目 sjzar/chatlog 已于 2025-10 被作者因合规风险移除。
> 本适配器只调用「用户本地已部署的兼容服务」（默认 `http://127.0.0.1:5030`），
> 不包含任何数据解密能力。使用前请自行确认本地数据来源合法，并仅处理属于自己的聊天记录。
> **推荐优先使用 `textlog`**（自己导出的文件）作为聊天记录的合规接入路径。

> ⚠️ **dida365 接口提示**：习惯打卡与任务备注来自滴答清单 Web 端使用的**非官方接口**
> （`api.dida365.com/api/v2/*`），不受官方 SLA 保护，可能随版本变动。
> token 仅在本机与滴答服务器之间传输，请勿分享给他人。
> 完整的选型调研、实测接口结构与测试报告见 [docs/实践/记录/滴答清单.md](../../docs/实践/记录/滴答清单.md)。

> ⚠️ **B站 接口提示**：来自 Web 端**非官方 API**（`api.bilibili.com` 下的 `relation/stat`
> / `x/space/wbi/arc/search` / `x/web-interface/view`），不受 SLA 保护，可能随版本变动。
> 投稿统计需要登录 Cookie；从浏览器登录 bilibili.com 后复制 Cookie（至少 `SESSDATA`+`buvid3`）以 `--cookie` 传入。
> 详细策略与各平台接入对照见 [docs/理论/调研/品牌/数据接入.md](../../docs/理论/调研/品牌/数据接入.md)。

## 使用

```bash
# 从 MeOS 仓库根目录
pnpm --filter @meos/melog-connectors build
node packages/connectors/dist/cli.js --help

# Apple 健康（从 iPhone「导出所有健康数据」得到的 zip）
node packages/connectors/dist/cli.js apple-health \
  --export ~/Downloads/export.zip --days 30

# chatlog 兼容服务
node packages/connectors/dist/cli.js chatlog \
  --chatlog-url http://127.0.0.1:5030 --days 3

# 滴答清单（先 --dry-run 验证 token 与数据形态，再正式推送）
node packages/connectors/dist/cli.js dida365 --dry-run --days 30
node packages/connectors/dist/cli.js dida365 --days 30

# 只同步打卡 / 只同步备注；国际端 TickTick 换 --api-base
node packages/connectors/dist/cli.js dida365 --no-tasks
node packages/connectors/dist/cli.js dida365 --no-habits
node packages/connectors/dist/cli.js dida365 --api-base https://api.ticktick.com

# 指定 MeOS 地址与 Token（开发模式可省略 Token）
node packages/connectors/dist/cli.js chatlog \
  --meos-url http://localhost:3001 --token <token>
```

### B站 cookie 获取

1. 浏览器登录 [bilibili.com](https://www.bilibili.com)
2. 打开 DevTools → Application → Cookies → `https://www.bilibili.com`
3. 复制全部 Cookie（至少包含 `SESSDATA`、`buvid3`、`buvid4`），例如：`SESSDATA=xxxx; buvid3=xxxx; buvid4=xxxx`
4. 通过 `--cookie` 或环境变量 `BILIBILI_COOKIE` 传入：

```bash
export BILIBILI_COOKIE='SESSDATA=xxxx; buvid3=xxxx; buvid4=xxxx'

# 仅粉丝数（匿名可用，投稿列表需 cookie）
node packages/connectors/dist/cli.js brand-bilibili --mid 123456 --max-videos 0

# 粉丝数 + 投稿统计（需 cookie）
node packages/connectors/dist/cli.js brand-bilibili --mid 123456 --max-videos 100

# 指定目标渠道（避免自动匹配到同名多个渠道）
node packages/connectors/dist/cli.js brand-bilibili --mid 123456 --channel-id <id>

# 试运行不写入 MeOS
node packages/connectors/dist/cli.js brand-bilibili --mid 123456 --dry-run
```

`brand-bilibili` 不写 MeLog（不污染时间线），只把数据写入品牌板块的 `MetricSnapshot`；
followers 是当前**累计**值，views/likes/comments/shares 是与上次游标对比的**本周期增量**，
首次运行记为基线（增量字段为 null），不覆盖已有的累计游标。

`brand-youtube` / `brand-github` 同样只写品牌快照；详见 [docs/实践/品牌/快照调度.md](../../docs/实践/品牌/快照调度.md)（含每日定时调度脚本与 cron 示例）。

### 滴答清单 token 获取

1. 浏览器登录 [dida365.com](https://dida365.com)（国际端为 ticktick.com）
2. 打开 DevTools → Application → Cookies → `https://dida365.com`
3. 复制名为 **`t`** 的 Cookie 值
4. 通过 `--token <t>` 或环境变量 `DIDA365_TOKEN` 传入：

```bash
export DIDA365_TOKEN='<t 的值>'
```

状态（最近一次运行摘要）保存在 `~/.melog/connectors/cli-<命令>.json`。

## 编程接口

```ts
import { MeLogIngestClient, aggregateDaily, parseAppleHealthExport, collectDida365Entries } from '@meos/melog-connectors';

const client = new MeLogIngestClient({ apiUrl: 'http://localhost:3001', token: '…' });
const records = await parseAppleHealthExport(createReadStream('export.xml'));
await client.ingest('apple-health', 'Apple 健康', 'health', aggregateDaily(records, { days: 30 }));

const collected = await collectDida365Entries({ token: process.env.DIDA365_TOKEN! });
```

## 设计约定

- **幂等**：所有条目带稳定 `externalId`（如 `ah-sleep-2026-09-03`、`chatlog-1001`），重复推送只更新。
- **天级聚合**：健康指标按天聚合为一条（细节保留在 `payload` 中，如 `sleepStages`）。
- **本地优先**：连接器在用户设备上运行，只与本地 chatlog 服务和本地 MeOS 通信。
