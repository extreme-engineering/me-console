import api, { useLocalMode } from './api';

/**
 * 使用向导步骤注册表。
 *
 * 每一步对应一个「关键问题」：check() 返回该步已录入的条目数，
 * 返回 null 表示当前数据模式不支持该步（向导中隐藏，不算入进度）。
 * 数据失败同样按 null 处理——宁可少一步，不让向导卡死。
 */
export interface OnboardingStep {
  id: string;
  module: string;
  title: string;
  question: string;
  why: string;
  route: string;
  check: () => Promise<number | null>;
}

const countOf = (data: unknown, key: string): number => {
  const obj = data as Record<string, unknown> | null | undefined;
  const named = obj?.[key];
  if (Array.isArray(named)) return named.length;
  if (Array.isArray(obj)) return obj.length;
  return 0;
};

const listCount =
  (url: string, ...keys: string[]) =>
  async (): Promise<number | null> => {
    try {
      const res = await api.get(url);
      for (const key of keys) {
        const n = countOf(res.data, key);
        if (n > 0) return n;
      }
      return 0;
    } catch {
      return null;
    }
  };

const visionCount = async (): Promise<number | null> => {
  try {
    const res = await api.get('/visions');
    const v = (res.data as { vision?: { content?: string } | null })?.vision;
    return v && typeof v.content === 'string' && v.content.trim().length > 0 ? 1 : 0;
  } catch {
    return null;
  }
};

const melogSourceCount = async (): Promise<number | null> => {
  if (useLocalMode === 'local') return null;
  try {
    const res = await api.get('/melog/overview');
    const data = res.data as { sources?: { total?: number }[] } | undefined;
    const total = data?.sources?.[0]?.total;
    return typeof total === 'number' && total >= 0 ? total : 0;
  } catch {
    return null;
  }
};

const brandPillarCount = async (): Promise<number | null> => {
  // 品牌板块仅 Fastify 远端实现了接口；云端直连与本地 IndexedDB 均不可用
  if (useLocalMode !== 'remote') return null;
  return listCount('/brand/pillars', 'pillars')();
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'vision',
    module: '定方向',
    title: '长期愿景',
    question: '你想成为什么样的人？未来 3-5 年要抵达哪里？',
    why: '愿景是一切目标的锚点，MeOS 会把它展示在首页提醒你。',
    route: '/direction?tab=vision',
    check: visionCount,
  },
  {
    id: 'domains',
    module: '定方向',
    title: '生活领域',
    question: '你的生活由哪些领域组成？',
    why: '领域是平衡轮和目标分类的基础，建议先定义 5-8 个。',
    route: '/direction?tab=domains',
    check: listCount('/domains', 'domains'),
  },
  {
    id: 'goals',
    module: '定方向',
    title: '核心目标',
    question: '当前最重要的目标是什么？',
    why: '目标支持挂关键结果（OKR），并能把行动任务关联进来。',
    route: '/direction?tab=goals',
    check: listCount('/goals', 'goals'),
  },
  {
    id: 'todos',
    module: '行动',
    title: '今日任务',
    question: '今天要推进哪些事？',
    why: '任务分紧急 / 高 / 中 / 低四级优先级，可以关联到目标上。',
    route: '/action?tab=todos',
    check: listCount('/todos', 'todos'),
  },
  {
    id: 'habits',
    module: '行动',
    title: '习惯养成',
    question: '想长期坚持哪些习惯？',
    why: '打卡习惯会累计连击与完成率，适合日记、运动这类日常动作。',
    route: '/action?tab=habits',
    check: listCount('/habits', 'habits'),
  },
  {
    id: 'topics',
    module: '认知',
    title: '研究课题',
    question: '你正在钻研哪些课题？',
    why: '课题把零散笔记收拢成线，每条课题下可以追加进展笔记。',
    route: '/cognition?tab=topics',
    check: listCount('/topics', 'topics'),
  },
  {
    id: 'insights',
    module: '认知',
    title: '洞察沉淀',
    question: '有哪些值得记录的想法或顿悟？',
    why: '洞察会进入认知库，复盘时能随时回看当时的思考。',
    route: '/cognition?tab=insights',
    check: listCount('/insights', 'insights'),
  },
  {
    id: 'reading',
    module: '认知',
    title: '阅读清单',
    question: '在读和想读的书 / 文章有哪些？',
    why: '阅读条目支持状态流转与笔记，读完自动沉淀到认知库。',
    route: '/cognition?tab=reading',
    check: listCount('/reading', 'items'),
  },
  {
    id: 'reflections',
    module: '反思',
    title: '每日反思',
    question: '今天过得怎么样？',
    why: '每日反思按固定小节记录，AI 会基于它做周期总结。',
    route: '/reflection?tab=daily',
    check: listCount('/reflections', 'reflections'),
  },
  {
    id: 'reviews',
    module: '反思',
    title: '周期复盘',
    question: '为本周 / 本月做一次复盘？',
    why: '周期复盘汇总反思与数据，帮你看清一段时间的走势。',
    route: '/reflection?tab=periodic',
    check: listCount('/reviews', 'reviews'),
  },
  {
    id: 'subscriptions',
    module: '资源',
    title: '订阅管理',
    question: '你订阅了哪些服务？',
    why: '记录费用与额度，用量仪表盘帮你发现闲置浪费。',
    route: '/resources?tab=assets',
    // Fastify 远端把分页列表包在 data 里，supabase/local 用 subscriptions 键
    check: listCount('/subscriptions', 'subscriptions', 'data'),
  },
  {
    id: 'contacts',
    module: '资源',
    title: '人脉档案',
    question: '重要的人脉有哪些？',
    why: '记录联系人与触达时间，长期不见面的人会被提醒。',
    route: '/resources?tab=contacts',
    check: listCount('/contacts', 'contacts'),
  },
  {
    id: 'health',
    module: '行动',
    title: '身体数据',
    question: '记录一条身体数据（体重、血压…）？',
    why: '健康记录与习惯打卡同页，坚持记录才能看出趋势。',
    route: '/action?tab=habits',
    check: listCount('/health', 'records'),
  },
  {
    id: 'melog',
    module: 'MeLog',
    title: '生活数据源',
    question: '接入一个生活数据源（浏览器插件 / CLI）？',
    why: 'MeLog 把浏览、命令行等活动自动汇总成生活流水。',
    route: '/melog?tab=sources',
    check: melogSourceCount,
  },
  {
    id: 'brand',
    module: '品牌',
    title: '品牌蓝本',
    question: '定义你的个人品牌：定位与内容支柱？',
    why: '品牌板块管理定位、渠道与作品集，先建一条内容支柱。',
    route: '/brand?tab=profile',
    check: brandPillarCount,
  },
];

// ---------- 跳过状态持久化（localStorage） ----------

const SKIP_KEY = 'meos.onboarding.skips';

export function loadSkips(): Set<string> {
  try {
    const raw = localStorage.getItem(SKIP_KEY);
    if (!raw) return new Set();
    const arr: unknown = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveSkip(id: string, skipped: boolean): void {
  const skips = loadSkips();
  if (skipped) skips.add(id);
  else skips.delete(id);
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify([...skips]));
  } catch {
    // 隐私模式等场景下写入失败可接受，跳过状态不持久
  }
}

export function clearSkips(): void {
  try {
    localStorage.removeItem(SKIP_KEY);
  } catch {
    // 同上
  }
}

// ---------- 状态聚合 ----------

export type StepState = 'filled' | 'todo' | 'skipped';

export interface StepStatusInfo {
  step: OnboardingStep;
  count: number;
  state: StepState;
}

export async function loadStepStatuses(): Promise<StepStatusInfo[]> {
  const skips = loadSkips();
  const checked = await Promise.all(
    ONBOARDING_STEPS.map(async (step) => {
      let count: number | null = null;
      try {
        count = await step.check();
      } catch {
        count = null;
      }
      return { step, count };
    }),
  );
  return checked
    .filter((c): c is { step: OnboardingStep; count: number } => c.count !== null)
    .map(({ step, count }) => ({
      step,
      count,
      state: count > 0 ? 'filled' : skips.has(step.id) ? 'skipped' : 'todo',
    }));
}

export interface Progress {
  total: number;
  done: number;
  pending: number;
  percent: number;
}

export function progressOf(statuses: StepStatusInfo[]): Progress {
  const total = statuses.length;
  const done = statuses.filter((s) => s.state === 'filled').length;
  return {
    total,
    done,
    pending: total - done,
    percent: total === 0 ? 100 : Math.round((done / total) * 100),
  };
}
