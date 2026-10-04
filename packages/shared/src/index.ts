/**
 * MeOS Shared Types
 * 前后端共享的核心类型定义
 */

// ==================== 认证类型 ====================

export interface AuthenticatedUser {
  userId: string;
}

// ==================== 基础类型 ====================

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== 方向 (Direction) ====================

export interface Vision {
  id: string;
  userId: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Domain {
  id: string;
  userId: string;
  identifier: string;
  name: string;
  icon: string | null;
  weight: number;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type GoalStatus = 'planned' | 'active' | 'completed' | 'abandoned';
export type Priority = 'high' | 'medium' | 'low';

export interface KeyResult {
  id: string;
  goalId: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  startDate: string | null;
  endDate: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  domainId: string;
  title: string;
  description: string | null;
  status: GoalStatus;
  priority: Priority;
  startDate: string | null;
  endDate: string | null;
  order: number;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
  domain?: Domain;
  keyResults?: KeyResult[];
  todos?: Todo[];
  habits?: Habit[];
  topics?: Topic[];
}

export interface MindsetSlogan {
  id: string;
  userId: string;
  content: string;
  category: string;
  order: number;
  domainId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceWheelScore {
  id: string;
  userId: string;
  domainId: string;
  score: number;
  note?: string;
  createdAt: string;
  domain?: Domain;
}

// ==================== 行动 (Action) ====================

export type TodoStatus = 'inbox' | 'todo' | 'doing' | 'done' | 'cancelled';
export type Urgency = 'urgent' | 'high' | 'medium' | 'low';

export interface Todo {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: Urgency;
  dueDate: string | null;
  goalId: string | null;
  domainId: string | null;
  source: string;
  estimatedMinutes: number | null;
  energy: 'high' | 'medium' | 'low' | null;
  order: number;
  completedAt: string | null;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
  goal?: Goal;
  domain?: Domain;
}

export type HabitFrequency = 'daily' | 'weekly';

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  note: string | null;
  createdAt: string;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  frequency: HabitFrequency;
  targetPerWeek: number | null;
  goalId: string | null;
  domainId: string | null;
  color: string | null;
  isActive: boolean;
  order: number;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
  logs?: HabitLog[];
}

// ==================== 认知 (Cognition) ====================

export type TopicStatus = 'exploring' | 'researching' | 'practicing' | 'breakthrough' | 'ongoing' | 'archived';

export interface TopicNote {
  id: string;
  topicId: string;
  userId: string;
  content: string;
  noteType: 'reflection' | 'insight' | 'breakthrough' | 'setback';
  createdAt: string;
}

export interface Topic {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: string;
  status: TopicStatus;
  priority: Priority;
  currentUnderstanding: string | null;
  actionPlan: string | null;
  relatedDomainId: string | null;
  goalId: string | null;
  order: number;
  isMock?: boolean;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
  notes?: TopicNote[];
  insights?: InsightNote[];
  readingItems?: ReadingItem[];
  _count?: { notes: number };
}

export interface InsightNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string | null;
  category: string | null;
  topicId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReadingType = 'book' | 'article' | 'video' | 'podcast' | 'course';
export type ReadingStatus = 'want' | 'reading' | 'done' | 'abandoned';

export interface ReadingItem {
  id: string;
  userId: string;
  title: string;
  author: string | null;
  type: ReadingType;
  status: ReadingStatus;
  url: string | null;
  note: string | null;
  rating: number | null;
  topicId: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== 反思 (Reflection) ====================

export interface Reflection {
  id: string;
  userId: string;
  date: string;
  type: string;
  celebrations: string | null;
  improvements: string | null;
  tomorrow: string | null;
  content: string | null;
  mood: string | null;
  tags: string | null;
  domainId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodicReview {
  id: string;
  userId: string;
  period: string;
  startDate: string;
  endDate: string;
  achievements: string | null;
  challenges: string | null;
  insights: string | null;
  nextFocus: string | null;
  dataSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== 资源 (Resources) ====================

export interface Contact {
  id: string;
  userId: string;
  name: string;
  title: string | null;
  company: string | null;
  relation: string | null;
  tags: string | null;
  notes: string | null;
  contactFreq: string | null;
  lastContact: string | null;
  domainId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthRecord {
  id: string;
  userId: string;
  type: string;
  value: number;
  unit: string;
  note: string | null;
  recordedAt: string;
  createdAt: string;
}

export interface QuotaDefinition {
  id: string;
  subscriptionId: string;
  name: string;
  unit: string;
  monthlyLimit: number;
  warningThreshold: number;
  criticalThreshold: number;
  order: number;
  quotaType: string;
}

export interface Subscription {
  id: string;
  userId: string;
  name: string;
  provider: string;
  billingCycle: string;
  costPerCycle: number;
  currency: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  autoRenew: boolean;
  websiteUrl?: string;
  notes?: string;
  quotas: QuotaDefinition[];
  createdAt: string;
  updatedAt: string;
}

// ==================== MeLog (生活数据汇聚) ====================

export type MeLogCategory = 'health' | 'note' | 'im' | 'media' | 'location' | 'custom';

export const MELOG_CATEGORIES: MeLogCategory[] = ['health', 'note', 'im', 'media', 'location', 'custom'];

export interface MeLogSource {
  id: string;
  userId: string;
  name: string;
  category: MeLogCategory;
  adapter: string;
  endpoint?: string;
  config?: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: string;
  syncCursor?: string;
  entryCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** MeLog Standard 统一事件信封（MeLogEntry） */
export interface MeLogEntry {
  id: string;
  userId: string;
  sourceId: string;
  externalId?: string;
  category: MeLogCategory;
  type: string;
  title: string;
  content?: string;
  payload?: string;
  tags?: string;
  actor?: string;
  occurredAt: string;
  createdAt: string;
}

export interface MeLogSkill {
  id: string;
  userId: string;
  slug: string;
  name: string;
  description?: string;
  version: string;
  source: 'builtin' | 'community' | 'custom';
  config?: string;
  isActive: boolean;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeLogRun {
  id: string;
  userId: string;
  skillId: string;
  status: 'running' | 'succeeded' | 'failed';
  periodStart?: string;
  periodEnd?: string;
  summary?: string;
  result?: string;
  stats?: string;
  entryIds?: string;
  createdAt: string;
}

export interface MeLogOverview {
  totalEntries: number;
  last7Days: number;
  last30Days: number;
  byCategory: { category: string; count: number; last7Days: number }[];
  sources: { total: number; connected: number; error: number }[];
  latestRuns: MeLogRun[];
  llm: { configured: boolean; model?: string };
  /** 数据边界：被排除在云端读写之外的敏感分类（本地模式为空） */
  sensitiveExcluded?: string[];
}

// ==================== 品牌 (Brand) ====================

export type ContentStatus = 'idea' | 'drafting' | 'ready' | 'published' | 'archived';
export type ContentType = 'article' | 'short-video' | 'long-video' | 'thread' | 'podcast' | 'other';
export type ChannelStatus = 'active' | 'paused' | 'dormant';
export type DistributionStatus = 'planned' | 'published';
export type WorkType = 'book' | 'course' | 'app' | 'miniprogram' | 'webapp' | 'other';
export type WorkStatus = 'concept' | 'in_progress' | 'launched' | 'maintained' | 'archived';

export interface BrandProfile {
  id?: string;
  userId?: string;
  mission?: string | null;
  positioning?: string | null;
  slogan?: string | null;
  personaTags?: string | null;
  toneOfVoice?: string | null;
  targetAudience?: string | null;
  visualNotes?: string | null;
  isMock?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandPillar {
  id: string;
  userId: string;
  profileId: string;
  name: string;
  description?: string | null;
  order: number;
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformChannel {
  id: string;
  userId: string;
  platform: string;
  name: string;
  handle?: string | null;
  url?: string | null;
  positioning?: string | null;
  cadence?: string | null;
  status: ChannelStatus;
  order: number;
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentDistribution {
  id: string;
  userId: string;
  contentId: string;
  channelId: string;
  status: DistributionStatus;
  adaptedTitle?: string | null;
  url?: string | null;
  publishedAt?: string | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  note?: string | null;
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
  channel?: PlatformChannel;
}

export interface ContentItem {
  id: string;
  userId: string;
  title: string;
  type: ContentType;
  status: ContentStatus;
  coreMessage?: string | null;
  outline?: string | null;
  priority: 'low' | 'medium' | 'high';
  publishDue?: string | null;
  pillarId?: string | null;
  topicId?: string | null;
  reviewNote?: string | null;
  tags?: string | null;
  publishedAt?: string | null;
  order: number;
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
  pillar?: BrandPillar | null;
  topic?: { id: string; title: string } | null;
  distributions?: ContentDistribution[];
}

export interface Work {
  id: string;
  userId: string;
  name: string;
  type: WorkType;
  status: WorkStatus;
  description?: string | null;
  progress?: string | null;
  url?: string | null;
  launchedAt?: string | null;
  order: number;
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MetricSnapshot {
  id: string;
  userId: string;
  channelId: string;
  followers: number;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  revenue?: number | null;
  note?: string | null;
  isMock?: boolean;
  recordedAt: string;
  createdAt: string;
}

export interface BrandOverview {
  profile: { slogan?: string | null; mission?: string | null } | null;
  pipeline: Record<ContentStatus, number>;
  publishedThisWeek: number;
  publishedThisMonth: number;
  channels: {
    id: string;
    name: string;
    platform: string;
    status: ChannelStatus;
    latest: { followers: number; views: number | null; recordedAt: string } | null;
    followerDelta: number | null;
    snapshotCount: number;
  }[];
  trends: { channelId: string; name: string; series: { recordedAt: string; followers: number }[] }[];
  pillars: { id: string; name: string; contentCount: number }[];
  /** 所有渠道本周期增量汇总（按 recordedAt 时间窗口聚合，不分空/基线） */
  totals: {
    week: { followersDelta: number; views: number; likes: number; comments: number; shares: number };
    month: { followersDelta: number; views: number; likes: number; comments: number; shares: number };
  };
  /** 最近 12 周各周增量（7 天一桶，index 0 = 最近一周） */
  weeklyTrend: {
    label: string;
    followersDelta: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }[];
  /** 近 30 天内容产出摘要：发布总数、环比、类型分布、支柱分布 */
  contentDigest: {
    total: number;
    previousTotal: number;
    delta: number;
    byType: Record<string, number>;
    byPillar: { id: string; name: string; count: number }[];
  };
}

// ==================== 商机 (Opportunity) ====================

export type OpportunityTrack = 'fde' | 'meditation' | 'trade';

export type OpportunityStage =
  | 'lead'
  | 'contacted'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'delivered'
  | 'lost';

export const OPPORTUNITY_TRACKS = ['fde', 'meditation', 'trade'] as const;

export const OPPORTUNITY_STAGES = [
  'lead',
  'contacted',
  'proposal',
  'negotiation',
  'won',
  'delivered',
  'lost',
] as const;

/** 活跃阶段（未到终局），用于跟进提醒与漏斗统计 */
export const ACTIVE_OPPORTUNITY_STAGES: OpportunityStage[] = [
  'lead',
  'contacted',
  'proposal',
  'negotiation',
];

export const OPPORTUNITY_TRACK_LABELS: Record<OpportunityTrack, string> = {
  fde: 'FDE',
  meditation: '冥想师',
  trade: '外贸',
};

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  lead: '线索',
  contacted: '已接触',
  proposal: '方案',
  negotiation: '谈判',
  won: '已成交',
  delivered: '已交付',
  lost: '已关闭',
};

/** 合伙人名单：商机归属维度，也可用于板块内过滤 */
export const PARTNERS = ['潘震', '叶佳', '曹军', '程朗'] as const;
export type Partner = (typeof PARTNERS)[number];

export interface Opportunity {
  id: string;
  userId: string;
  track: OpportunityTrack;
  title: string;
  stage: OpportunityStage;
  company?: string | null;
  category?: string | null;
  source?: string | null;
  partner?: string | null;
  contact?: string | null;
  /** 预估金额（元） */
  amount?: number | null;
  link?: string | null;
  notes?: string | null;
  order: number;
  isMock?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpportunityInput {
  track: OpportunityTrack;
  title: string;
  stage?: OpportunityStage;
  company?: string | null;
  category?: string | null;
  source?: string | null;
  partner?: string | null;
  contact?: string | null;
  amount?: number | null;
  link?: string | null;
  notes?: string | null;
}

export type UpdateOpportunityInput = Partial<CreateOpportunityInput>;

// ==================== API 响应类型 ====================

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Re-export pagination utilities
export { getPaginationParams, createPaginatedResponse } from './pagination.js';
export type { PaginationInput, PaginationResult } from './pagination.js';
