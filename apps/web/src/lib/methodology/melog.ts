import type { MethodologyMap } from './types';

export const melog: MethodologyMap = {
  'melog:timeline': {
    title: '统一时间线',
    philosophy: '本地优先：把散落各处的数据孤岛汇入一条统一时间线，供 AI 与工具读写。',
    principles: [
      '按 occurredAt（发生时间而非采集时间）归一排列',
      '六类筛选：健康/笔记/沟通/媒体/足迹/其他，支持全文检索',
      '顶部看板：近 7 天 / 30 天汇总 + 数据源健康状态',
      '一切来源归一为事件信封：category+type+title+payload+tags',
      '手动单条写入与批量 ingest 双通道，幂等去重',
    ],
    background: '你的数据散落在十几个 App 里：微信读书的阅读记录、Apple Health 的健康数据、Obsidian 的笔记、微信的聊天记录。每个 App 都是一座数据孤岛，彼此之间无法对话。统一时间线的核心洞察是：所有数据都可以归一为一种事件信封（category + type + title + payload + tags），按发生时间排列。本地优先意味着数据先存在你自己的设备上，再决定要不要同步到云端——你拥有数据的完全控制权。',
    guide: [
      '理解事件信封：category（大类）+ type（具体类型）+ title（标题）+ payload（结构化数据）+ tags（标签）',
      '按 occurredAt 排列：事件发生的时间，不是你记录的时间；补录的数据要填原始发生时间',
      '六类筛选：健康（运动/睡眠/饮食）、笔记（想法/摘录）、沟通（消息/邮件）、媒体（阅读/观看）、足迹（位置/出行）、其他',
      '顶部看板：近 7 天/30 天的数据量汇总 + 各数据源的健康状态（最后同步时间、数据量）',
      '手动写入：单条数据直接写入；批量 ingest：从其他 App 导出后批量导入，幂等去重',
    ],
    pitfalls: [
      { trap: '数据采集时间当发生时间——补录的数据时间错乱', remedy: '补录时填 occurredAt 为原始发生时间，不是录入时间' },
      { trap: '重复导入——同一份数据导入两次', remedy: '幂等键 (source, externalId)：重复推送更新而非新建' },
      { trap: '数据孤岛——只导入了一个 App 的数据', remedy: '逐步接入更多数据源；每接入一个，时间线的价值就增加一分' },
    ],
    notes: [
      '本地优先不是拒绝云端，而是先把数据掌握在自己手里，再决定要不要同步',
      '时间线的价值随数据量指数增长：100 条数据没什么用，10000 条数据就能发现模式',
      'payload 必须是合法 JSON：结构化数据才能被 AI 和工具处理',
    ],
    practice: '在 MeLog 页的时间线标签中查看你的统一时间线。用六类筛选查看不同维度的数据。如果某个数据源还没有接入，去"数据源"标签查看接入方式。',
  },
  'melog:sources': {
    title: '连接器接入',
    philosophy: '标准先行：连接器按统一信封把各 App 数据汇入本地 SQLite。',
    principles: [
      '内置目录：chatlog / Apple Health / 华为健康 / Obsidian / Notion / Webhook',
      '注册数据源后 POST /api/melog/ingest 推送，页面附可复制 curl',
      'adapter=协议、name=实例，组合唯一；全小写中划线命名',
      '幂等键 (source, externalId)：重复推送更新而非新建',
      '优先官方导出 / API 数据源；只接入自己有权使用的数据',
    ],
    background: '连接器是数据孤岛与统一时间线之间的桥梁。每个连接器负责把一个 App 的数据格式转换为统一的事件信封格式，然后推送到本地 SQLite。标准先行意味着所有连接器都遵循同一个协议：adapter 定义数据格式（如 apple-health、obsidian），name 定义具体实例（如 my-iphone、work-vault）。幂等键确保重复推送不会产生重复数据——同一条数据推多少次都只有一条记录。',
    guide: [
      '查看内置目录：chatlog（微信聊天）/ Apple Health / 华为健康 / Obsidian / Notion / Webhook（通用）',
      '注册数据源：选择 adapter（协议），填写 name（实例名），组合唯一；全小写中划线命名',
      '推送数据：POST /api/melog/ingest，页面附可复制 curl 命令',
      '幂等去重：每条数据有唯一键 (source, externalId)；重复推送更新而非新建',
      '优先官方数据源：官方导出/API 比第三方抓取更稳定、更合规',
    ],
    pitfalls: [
      { trap: '重复推送——同一份数据推了两次', remedy: '幂等键 (source, externalId) 确保重复推送更新而非新建' },
      { trap: '命名不规范——adapter 和 name 混乱', remedy: '全小写中划线命名；adapter=协议、name=实例，组合唯一' },
      { trap: '接入无权限数据——抓取别人的数据', remedy: '只接入自己有权使用的数据；尊重数据隐私和使用条款' },
    ],
    notes: [
      'Webhook 是通用入口：任何支持 Webhook 的 App 都可以接入，不需要专门的连接器',
      '数据源的健康状态很重要：最后同步时间超过 7 天的数据源需要检查',
      '接入新数据源时先用小批量数据测试，确认格式正确后再批量导入',
    ],
    practice: '在 MeLog 页的数据源标签中查看已注册的连接器。要接入新数据源，点击"注册数据源"，选择 adapter，填写 name，然后用页面上的 curl 命令推送数据。',
  },
  'melog:skills': {
    title: '技能引擎',
    philosophy: '预封装最佳实践加工时间线：规则引擎兜底，LLM 可选增强。',
    principles: [
      '三个内置技能：健康洞察 / 知识回顾 / 生活复盘，产出 Markdown 报告',
      '引擎三档 auto/rule/llm：LLM 失败自动回退规则引擎并注明',
      '输出契约固定：summary 一行 + result 报告 + stats + entryIds 血缘',
      '定时调度：daily 定时或 interval 固定间隔，错过自动补跑',
      '隐私边界：条目只发自己配置的端点，未配置零外发',
    ],
    background: '技能引擎是时间线的加工层——它把原始数据转化为有洞察的报告。三个内置技能覆盖了最常用的场景：健康洞察（分析健康数据趋势）、知识回顾（回顾笔记和阅读记录）、生活复盘（综合分析一周的生活数据）。规则引擎兜底意味着即使没有配置 LLM，技能也能用预定义规则产出有用的报告；LLM 增强则是在规则基础上提供更深入的分析。隐私边界是底线：你的数据只发送到你明确配置的端点，未配置就零外发。',
    guide: [
      '查看内置技能：健康洞察（健康数据趋势）、知识回顾（笔记和阅读回顾）、生活复盘（综合生活数据）',
      '选择引擎档位：auto（自动选择）、rule（规则引擎，无需 LLM）、llm（LLM 增强，需要配置端点）',
      '理解输出契约：summary（一行摘要）+ result（完整 Markdown 报告）+ stats（统计数据）+ entryIds（血缘，报告基于哪些数据）',
      '配置定时调度：daily（每天固定时间）或 interval（固定间隔）；错过的任务自动补跑',
      '配置隐私边界：LLM 端点只发你自己配置的地址；未配置则只使用规则引擎，零外发',
    ],
    pitfalls: [
      { trap: 'LLM 失败就放弃——没有配置回退', remedy: '引擎三档 auto/rule/llm：LLM 失败自动回退规则引擎并注明' },
      { trap: '数据外泄——不知道数据发到了哪里', remedy: '隐私边界：条目只发自己配置的端点，未配置零外发' },
      { trap: '报告没有血缘——不知道报告基于哪些数据', remedy: '输出契约固定：entryIds 记录报告基于哪些数据条目' },
    ],
    notes: [
      '规则引擎的价值：即使没有 LLM，预定义规则也能产出有用的报告；LLM 是增强而非必需',
      '定时调度的补跑机制：如果错过了调度时间（比如电脑关机），下次启动时自动补跑',
      '报告的血缘（entryIds）让你可以追溯到原始数据，验证报告的准确性',
    ],
    practice: '在 MeLog 页的技能标签中查看可用技能。点击"运行"手动触发一次，查看产出的 Markdown 报告。要定时运行，配置调度规则（daily 或 interval）。',
  },
  'melog:standard': {
    title: '开放数据标准',
    philosophy: '开放格式四原则：本地优先、幂等写入、来源可溯、分类稳定。',
    principles: [
      '统一事件信封 MeLogEntry：任何来源归一为同一种条目结构',
      '数值测量统一 {"value","unit"}，payload 必须合法 JSON',
      'Ingest API 单次 1-500 条，skipped 记录非法条目数',
      'MCP 四工具：overview / query / ingest / run_skill，AI 标准化读写',
      '版本策略：字段只增不改、新字段必须可选，破坏性变更升主版本',
    ],
    background: '开放数据标准是 MeLog 的基石——它定义了数据的格式、接口和版本策略，确保任何来源的数据都能归一为同一种结构，任何工具都能以标准化的方式读写。四原则：本地优先（数据先存在你的设备上）、幂等写入（重复推送不产生重复数据）、来源可溯（每条数据都能追溯到原始来源）、分类稳定（分类体系不轻易变更）。版本策略确保向后兼容：字段只增不改，新字段必须可选，破坏性变更升主版本。',
    guide: [
      '理解 MeLogEntry 结构：category + type + title + payload + tags + occurredAt + source + externalId',
      '数值测量统一格式：{"value": 70, "unit": "kg"}；payload 必须是合法 JSON',
      'Ingest API 规范：单次 1-500 条；skipped 记录非法条目数；幂等键 (source, externalId)',
      'MCP 四工具：overview（概览）/ query（查询）/ ingest（写入）/ run_skill（运行技能）',
      '版本策略：字段只增不改；新字段必须可选；破坏性变更升主版本',
    ],
    pitfalls: [
      { trap: 'payload 不是合法 JSON——数据无法被工具处理', remedy: 'payload 必须是合法 JSON；写入前验证格式' },
      { trap: '分类体系随意变更——导致历史数据失效', remedy: '分类稳定原则：分类体系不轻易变更；新分类通过 type 扩展' },
      { trap: '破坏性变更——删除或修改已有字段', remedy: '版本策略：字段只增不改；破坏性变更升主版本' },
    ],
    notes: [
      '开放标准的价值：任何工具都可以用标准化接口读写你的数据，不被特定工具锁定',
      'MCP 四工具让 AI 可以标准化地读写你的时间线：overview 看概览，query 查数据，ingest 写数据，run_skill 运行技能',
      '版本策略保护你的投资：今天写入的数据，10 年后仍然可以被正确读取',
    ],
    practice: '在 MeLog 页的标准标签中查看完整的数据格式规范。要接入新数据源或开发新工具时，参考这个标准确保兼容性。',
  },
};
