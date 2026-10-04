# MeOS 启动指南

## 1. 环境要求

- Node.js 18+（推荐 18–20 LTS，CI 使用 Node 20；Node 22 实测可正常启动与渲染，若遇异常再回退 20）
- pnpm >= 8.0.0

## 2. 日常开发：meos CLI

进程启动、停止、状态、日志、环境体检统一走一个零依赖脚本 `scripts/meos`
（只需 bash + curl + lsof）。它是进程监管逻辑的唯一实现，`dev.sh` 现在只是指向它的兼容壳。

```bash
./scripts/meos start          # 拉起前后端，健康检查通过才返回
./scripts/meos stop           # 干净停服
./scripts/meos status         # 谁在跑、真实监听 PID、运行时长、健康与否
./scripts/meos logs -f        # 跟随日志
```

也可写作 `pnpm meos <命令>`。

### 2.1 首次运行

```bash
./dev.sh                      # 等价于 ./scripts/meos start --bootstrap
```

`--bootstrap` 依次完成：`pnpm install` → 生成 `packages/api/.env`（含随机 `JWT_SECRET`）
→ `prisma generate` + `db push` → 灌品牌 mock 数据 → 启动。

日常迭代不要带 `--bootstrap`，直接 `meos start` 快得多。

### 2.2 停止与排查

```bash
./scripts/meos stop                   # 停两端
./scripts/meos stop --web             # 只停前端
./scripts/meos doctor                 # 环境体检（只读）：Node/pnpm/端口/依赖/.env/SQLite
./scripts/meos restart --api          # 只重启后端
./scripts/meos health                 # 探活，全通退出码 0，可用于脚本
```

`stop` 按**进程组**终止（TERM → 等待 → KILL），能穿透 `pnpm → tsx → node` 整棵树；
停之前会校验该进程的工作目录确实在本仓库内，**不会按进程名误杀你别处跑的 vite**。

### 2.3 其余命令

`meos help` 看全量。另有 `watch [秒]`（循环刷状态）、`db <push|seed|studio|…>`
（转发 Prisma）、`open`（打开浏览器）。

端口默认 `web :3000 / api :3001`，用 `MEOS_WEB_PORT` / `MEOS_API_PORT` 覆盖。
端口被占时**显式失败并点名占用者，不自动漂移端口**。

## 3. 手动启动（不用 meos 的原生路径）

```bash
pnpm install

# 初始化数据库（首次运行必做）
cd packages/api
pnpm db:generate     # 生成 Prisma 客户端
pnpm db:push         # 基于 schema 建表
pnpm db:seed         # 可选：填充示例数据
cd ../..

pnpm dev             # 同时启动前后端
# 或分别启动：
pnpm backend:dev     # 仅后端 → http://localhost:3001
pnpm web:dev         # 仅前端 → http://localhost:3015
```

注意这条路径由 turbo 前台托管，Ctrl+C 停当前终端；**没有** `meos` 的 pidfile 与进程组监管，
所以中途 kill 掉终端可能留下占端口的孤儿，此时 `meos status` 会把它标成 `running*`（未纳管）。

首次访问 http://localhost:3015 ，点击「立即注册」创建账号，系统会自动初始化 8 个默认生活领域（职业、健康、家庭、财务、学习、社交、休闲、精神）。

## 4. 环境变量

| 变量 | 位置 | 说明 |
|---|---|---|
| `JWT_SECRET` | `packages/api/.env` | **生产必填**，未设置时生产环境拒绝启动（`meos start --bootstrap` 会自动生成） |
| `MEOS_DEV_AUTH` | `packages/api/.env` | 设为 `true` 时跳过认证，使用 mock 用户 `mock-user-1`（仅开发） |
| `MELOG_LLM_BASE_URL` | `packages/api/.env` | OpenAI 兼容端点（DeepSeek / 通义兼容 / Moonshot / 本地 Ollama 等），启用 MeLog 技能 LLM 运行器 |
| `MELOG_LLM_API_KEY` | `packages/api/.env` | 对应 API Key，本地服务可填任意非空值 |
| `MELOG_LLM_MODEL` | `packages/api/.env` | 模型名，如 `deepseek-chat` |

> 隐私：未配置 `MELOG_LLM_*` 时，MeLog 数据不发生任何外发；配置后条目数据只发送到你自己配置的端点。

## 5. 环境验证

```bash
./scripts/meos doctor                        # 体检：Node/pnpm/端口/依赖/.env/SQLite 可写
./scripts/meos health                        # 探活两端，全通则退出码 0
pnpm test                                    # 全量测试（Vitest）
pnpm meos db studio                          # Prisma Studio 查看数据

curl http://localhost:3001/health            # 不依赖 CLI 的裸检查
```

## 6. 首次使用导览

| 板块 | 建议的第一步 |
|---|---|
| **Today**（`/`） | 添加今日待办、给习惯打卡，写下第一条每日反思 |
| **方向**（`/direction`） | 写下愿景 → 设一个带关键结果的目标 → 给八领域打平衡轮分数 |
| **行动**（`/action`） | 建立待办看板（inbox/todo/doing/done）与习惯清单 |
| **认知**（`/cognition`） | 开一个课题，沉淀洞察笔记，把在读的书加入阅读清单 |
| **反思**（`/reflection`） | 每日反思会自动汇总当日待办与习惯数据；周末做一次周期复盘 |
| **资源**（`/resources`） | 录入订阅、人脉与健康记录（会自动带入每日反思） |
| **MeLog**（`/melog`） | 创建数据源，用连接器或 Ingest API 推送健康/笔记/聊天数据，运行内置技能 |
| **品牌**（`/brand`） | 填写品牌档案 → 建内容支柱 → 在内容流水线排一期选题 |
| **Workbench**（`/workbench`） | 个人工作台：进行中项目、打卡与学习专题一屏聚合 |

方法论层面（每个板块为什么这样设计、怎么用出效果）见 [docs/理论/方法论/入门.md](./docs/理论/方法论/入门.md) 与 [docs/理论/方法论/总览.md](./docs/理论/方法论/总览.md)。

## 7. Chrome 扩展

```bash
pnpm web:build:extension     # 产物输出至 apps/web/extension-dist/
```

在 Chrome 中以「加载已解压的扩展程序」方式载入 `apps/chrome-extension/`，即可从浏览器快速唤起 MeOS。

## 8. 常见问题

### 数据库表不存在

注册时报 "The table `main.User` does not exist" 说明数据库尚未初始化：

```bash
cd packages/api
pnpm db:push
```

### 依赖安装失败

```bash
pnpm install --force
```

### Windows 25H2 前端启动报错 `Cannot read directory`

使用 Node.js 18–20 LTS；项目已通过 pnpm overrides 强制 esbuild 0.21.5。

### 端口被占用

`meos` **不会**自动清理端口，也不会按进程名 `kill`（旧 `dev.sh` 那么做会误杀你别处跑的
vite/tsx）。它只点名占用者，让你决定：

```bash
./scripts/meos status          # 看该端口是不是自己纳管的
./scripts/meos stop            # 是 meos 起的 → 直接停
lsof -nP -iTCP:3000 -sTCP:LISTEN    # 是外部进程 → 自己确认后再处理
MEOS_WEB_PORT=3200 ./scripts/meos start --web   # 或临时换端口起
```

若确认那个外部进程就是本仓库遗留的孤儿（`status` 里显示为 `running*` 未纳管），
`meos stop --web --force` 可停它——它仍会先校验该进程工作目录属于本仓库才动手。

更多文档见 [README 文档导航](./README.md#文档导航)。
