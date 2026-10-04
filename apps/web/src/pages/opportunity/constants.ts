import type { OpportunityStage, OpportunityTrack } from '@meos/shared';
import { ACTIVE_OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABELS } from '@meos/shared';

export interface TrackConfig {
  key: OpportunityTrack;
  label: string;
  description: string;
  categories: string[];
  sources: string[];
}

export const TRACK_CONFIGS: Record<OpportunityTrack, TrackConfig> = {
  fde: {
    key: 'fde',
    label: 'FDE',
    description: '前沿部署工程师 · IP 商业化：洞察报告 / 企业咨询 / 知识付费 / 商单',
    categories: ['洞察报告', '企业咨询', '知识付费', '商单合作', '演讲培训'],
    sources: ['公众号', '视频号', '朋友介绍', '主动开发', '线下活动'],
  },
  meditation: {
    key: 'meditation',
    label: '冥想师',
    description: '疗愈业务 · 心境重建训练营 / 量表 / 运营中心 / 机构合作',
    categories: ['机构合作', '量表测评', '训练营', '运营中心', '课程定制'],
    sources: ['机构拜访', '朋友介绍', '线上咨询', '社群', '老客户复购'],
  },
  trade: {
    key: 'trade',
    label: '外贸',
    description: '外贸生意 · 跨境业务 / 供应链 / 认证与合规',
    categories: ['跨境业务', '供应链', '认证咨询', '建站推广', '展会'],
    sources: ['展会', 'B2B 平台', '朋友介绍', '主动开发', '老客户复购'],
  },
};

// 漏斗列顺序（lost 放最后，卡片淡化展示）
export const STAGE_FLOW: OpportunityStage[] = [
  'lead',
  'contacted',
  'proposal',
  'negotiation',
  'won',
  'delivered',
  'lost',
];

export const STAGE_COLORS: Record<OpportunityStage, { dot: string; bg: string; text: string }> = {
  lead: { dot: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', text: '#64748b' },
  contacted: { dot: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)', text: '#0284c7' },
  proposal: { dot: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed' },
  negotiation: { dot: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)', text: '#b45309' },
  won: { dot: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', text: '#047857' },
  delivered: { dot: '#14b8a6', bg: 'rgba(20, 184, 166, 0.12)', text: '#0f766e' },
  lost: { dot: '#f43f5e', bg: 'rgba(244, 63, 94, 0.10)', text: '#be123c' },
};

export const PARTNER_COLORS: Record<string, string> = {
  潘震: '#0ea5e9',
  叶佳: '#8b5cf6',
  曹军: '#f59e0b',
  程朗: '#10b981',
};

/** 超过 N 天未更新且仍在活跃阶段的商机，进入「需跟进」提醒 */
export const FOLLOW_UP_DAYS = 7;

export function isStale(opp: { stage: OpportunityStage; updatedAt: string }): boolean {
  if (!ACTIVE_OPPORTUNITY_STAGES.includes(opp.stage)) return false;
  return Date.now() - new Date(opp.updatedAt).getTime() > FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000;
}

export function formatAmount(amount?: number | null): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  if (amount >= 10000) {
    const v = amount / 10000;
    return `¥${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}万`;
  }
  return `¥${amount}`;
}

export { OPPORTUNITY_STAGE_LABELS };
