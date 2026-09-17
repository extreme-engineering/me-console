// IndexedDB-based local database for Chrome Extension
// Mirrors the API interface used throughout the app

const DB_NAME = 'MeOS';
const DB_VERSION = 2;

interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: string;
}

interface Domain {
  id: string;
  userId: string;
  name: string;
  icon: string;
  identifier: string;
  description?: string;
  color: string;
  weight: number;
  score: number;
  order: number;
}

interface MindsetSlogan {
  id: string;
  userId: string;
  content: string;
  category: string;
  order: number;
  pinned: boolean;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BalanceWheelScoreRow {
  id: string;
  userId: string;
  domainId: string;
  score: number;
  note?: string;
  createdAt: string;
  domain?: { id: string; name: string; icon: string };
}

/** 早期版本一次提交存一行的旧格式，仅用于读旧数据兼容 */
interface LegacyBalanceWheelRecord {
  id: string;
  userId: string;
  scores: { domainId: string; score: number }[];
  createdAt: string;
}

interface TodaySummary {
  date: string;
  todos: { total: number; createdToday: number; items: string[] };
  habits: { total: number; items: string[] };
  health: { total: number; items: { type: string; value: number; unit: string; label: string }[] };
  summary: string;
}

interface Reflection {
  id: string;
  userId: string;
  content: string;
  date?: string;
  mood?: string;
  celebrations?: string;
  improvements?: string;
  tomorrow?: string;
  tags?: string;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Review {
  id: string;
  userId: string;
  period: string;
  content: string;
  startDate?: string;
  endDate?: string;
  highlights?: string;
  lowlights?: string;
  learnings?: string;
  nextActions?: string;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Insight {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags?: string | null;
  category?: string | null;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Topic {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: string;
  status: string;
  priority: string;
  currentUnderstanding?: string;
  actionPlan?: string;
  notes: TopicNote[];
  order: number;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TopicNote {
  id: string;
  topicId: string;
  userId: string;
  content: string;
  noteType: string;
  createdAt: string;
}

interface Todo {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'inbox' | 'todo' | 'doing' | 'done';
  dueDate?: string;
  goalId?: string;
  domainId?: string;
  completedAt?: string;
  mock?: boolean;
  createdAt: string;
}

interface Habit {
  id: string;
  userId: string;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly';
  targetPerWeek?: number;
  color: string;
  goalId?: string;
  domainId?: string;
  isActive: boolean;
  order: number;
  mock?: boolean;
  createdAt: string;
}

interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  note?: string;
}

interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  domainId?: string;
  status: string;
  priority: string;
  startDate?: string;
  endDate?: string;
  deadline?: string;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface KeyResult {
  id: string;
  goalId: string;
  userId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface Vision {
  id: string;
  userId: string;
  content: string;
  version: number;
  isActive: boolean;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Contact {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  company?: string;
  tags: string[];
  notes?: string;
  lastContact?: string;
  domainId?: string;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReadingItem {
  id: string;
  userId: string;
  title: string;
  author?: string;
  type: string;
  status: string;
  url?: string;
  note?: string;
  rating?: number;
  topicId?: string;
  startDate?: string;
  endDate?: string;
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HealthRecord {
  id: string;
  userId: string;
  type: string;
  value: number;
  unit: string;
  note?: string;
  date: string;
  recordedAt?: string;
  mock?: boolean;
  createdAt: string;
}

interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowStep {
  id: string;
  workflowId: string;
  entityType: 'vision' | 'goal' | 'keyResult' | 'todo' | 'habit';
  entityId: string;
  label: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  createdAt: string;
}

interface WorkflowConnection {
  id: string;
  workflowId: string;
  sourceStepId: string;
  targetStepId: string;
  sourceHandle: string;
  targetHandle: string;
  createdAt: string;
}

interface Subscription {
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
  config?: Record<string, unknown>;
  quotas: QuotaDefinition[];
  mock?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface QuotaDefinition {
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

interface MonthlyUsage {
  id: string;
  subscriptionId: string;
  userId: string;
  year: number;
  month: number;
  notes?: string;
  quotaUsages: QuotaUsage[];
}

interface QuotaUsage {
  id: string;
  monthlyUsageId: string;
  quotaDefinitionId: string;
  usedAmount: number;
}

interface SubscriptionDashboardSummary {
  subscriptions: {
    id: string;
    name: string;
    provider: string;
    monthlyCost: number;
    currency: string;
    overallUtilization: number;
    quotaUtilization: unknown[];
    daysUntilRenewal: number;
    isActive: boolean;
    autoRenew: boolean;
    mock?: boolean;
  }[];
  stats: {
    totalMonthlySpend: number;
    activeCount: number;
    nearLimitCount: number;
    criticalCount: number;
  };
}

let dbInstance: IDBDatabase | null = null;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// 与 packages/api/src/modules/reflection 的文案保持一致
const HEALTH_LABELS: Record<string, string> = {
  sleep: '睡眠',
  exercise: '运动',
  weight: '体重',
  mood: '心情',
  energy: '精力',
  water: '饮水',
  custom: '健康',
};

const UNIT_LABELS: Record<string, string> = {
  km: '公里',
  minutes: '分钟',
  hours: '小时',
  kg: '公斤',
  steps: '步',
};

function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}

function formatHealthItem(record: { type: string; value: number; unit: string }): string {
  const label = HEALTH_LABELS[record.type] ?? record.type;
  const unit = UNIT_LABELS[record.unit] ?? record.unit;
  return `${label} ${formatNumber(record.value)} ${unit}`;
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function omitPassword(user: User): Omit<User, 'password'> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('domains')) {
        const store = db.createObjectStore('domains', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('mindsets')) {
        const store = db.createObjectStore('mindsets', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('balanceWheel')) {
        const store = db.createObjectStore('balanceWheel', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('reflections')) {
        const store = db.createObjectStore('reflections', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('reviews')) {
        const store = db.createObjectStore('reviews', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('insights')) {
        const store = db.createObjectStore('insights', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('topics')) {
        const store = db.createObjectStore('topics', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('topicNotes')) {
        const store = db.createObjectStore('topicNotes', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('todos')) {
        const store = db.createObjectStore('todos', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('habits')) {
        const store = db.createObjectStore('habits', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('habitLogs')) {
        const store = db.createObjectStore('habitLogs', { keyPath: 'id' });
        store.createIndex('habitId', 'habitId', { unique: false });
      }

      if (!db.objectStoreNames.contains('goals')) {
        const store = db.createObjectStore('goals', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('subscriptions')) {
        const store = db.createObjectStore('subscriptions', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('monthlyUsage')) {
        const store = db.createObjectStore('monthlyUsage', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('visions')) {
        const store = db.createObjectStore('visions', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('contacts')) {
        const store = db.createObjectStore('contacts', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('readingItems')) {
        const store = db.createObjectStore('readingItems', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('healthRecords')) {
        const store = db.createObjectStore('healthRecords', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }

      if (!db.objectStoreNames.contains('workflows')) {
        const store = db.createObjectStore('workflows', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }

      if (!db.objectStoreNames.contains('workflowSteps')) {
        const store = db.createObjectStore('workflowSteps', { keyPath: 'id' });
        store.createIndex('workflowId', 'workflowId', { unique: false });
      }

      if (!db.objectStoreNames.contains('workflowConnections')) {
        const store = db.createObjectStore('workflowConnections', { keyPath: 'id' });
        store.createIndex('workflowId', 'workflowId', { unique: false });
      }

      if (!db.objectStoreNames.contains('keyResults')) {
        const store = db.createObjectStore('keyResults', { keyPath: 'id' });
        store.createIndex('goalId', 'goalId', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
  });
}

async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: string
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function add<T>(storeName: string, data: T): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

async function update<T>(storeName: string, data: T): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(data);
    request.onerror = () => reject(request.error);
  });
}

async function remove(storeName: string, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

let currentUserId: string | null = null;

export const localDB = {
  auth: {
    async login(email: string, password: string): Promise<{ user: Omit<User, 'password'>; token: string }> {
      const db = await openDB();
      const users = await new Promise<User[]>((resolve, reject) => {
        const tx = db.transaction('users', 'readonly');
        const store = tx.objectStore('users');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const user = users.find((u) => u.email === email && u.password === password);
      if (!user) {
        throw { response: { data: { error: '邮箱或密码错误' } } };
      }
      currentUserId = user.id;
      return { user: omitPassword(user), token: 'local-token-' + user.id };
    },

    async register(name: string, email: string, password: string): Promise<{ user: Omit<User, 'password'>; token: string }> {
      const db = await openDB();
      const users = await new Promise<User[]>((resolve, reject) => {
        const tx = db.transaction('users', 'readonly');
        const store = tx.objectStore('users');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (users.find((u) => u.email === email)) {
        throw { response: { data: { error: '该邮箱已被注册' } } };
      }

      const newUser: User = {
        id: generateId(),
        email,
        name,
        password,
        createdAt: new Date().toISOString(),
      };

      await add('users', newUser);
      currentUserId = newUser.id;
      await createDefaultDomains(newUser.id);

      return { user: omitPassword(newUser), token: 'local-token-' + newUser.id };
    },

    async getCurrentUser(): Promise<Omit<User, 'password'> | null> {
      if (!currentUserId) return null;
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('users', 'readonly');
        const store = tx.objectStore('users');
        const request = store.get(currentUserId!);
        request.onsuccess = () => {
          const user = request.result;
          if (user) {
            resolve(omitPassword(user));
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    },

    setCurrentUserId(userId: string | null) {
      currentUserId = userId;
    },

    getCurrentUserId(): string | null {
      return currentUserId;
    },
  },

  domains: {
    async getAll(): Promise<{ domains: Domain[] }> {
      const domains = currentUserId
        ? await getByIndex<Domain>('domains', 'userId', currentUserId)
        : [];
      return { domains };
    },

    async create(data: Partial<Domain>): Promise<{ domain: Domain }> {
      const domain: Domain = {
        id: generateId(),
        userId: currentUserId || '',
        name: data.name || '',
        icon: data.icon || 'career',
        identifier: data.identifier || '',
        description: data.description,
        color: data.color || '#64748B',
        weight: data.weight ?? 1,
        score: data.score ?? 5,
        order: data.order ?? 0,
      };
      await add('domains', domain);
      return { domain };
    },

    async update(id: string, data: Partial<Domain>): Promise<{ domain: Domain }> {
      const db = await openDB();
      const domain = await new Promise<Domain>((resolve, reject) => {
        const tx = db.transaction('domains', 'readwrite');
        const store = tx.objectStore('domains');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const updated = { ...domain, ...data };
      await update('domains', updated);
      return { domain: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('domains', id);
    },
  },

  mindsets: {
    async getAll(): Promise<{ slogans: MindsetSlogan[] }> {
      const slogans = currentUserId
        ? await getByIndex<MindsetSlogan>('mindsets', 'userId', currentUserId)
        : [];
      return { slogans };
    },

    async create(data: Omit<MindsetSlogan, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<{ slogan: MindsetSlogan }> {
      const now = new Date().toISOString();
      const slogan: MindsetSlogan = {
        ...data,
        id: generateId(),
        userId: currentUserId || '',
        createdAt: now,
        updatedAt: now,
      };
      await add('mindsets', slogan);
      return { slogan };
    },

    async update(id: string, data: Partial<MindsetSlogan>): Promise<{ slogan: MindsetSlogan }> {
      const db = await openDB();
      const slogan = await new Promise<MindsetSlogan>((resolve, reject) => {
        const tx = db.transaction('mindsets', 'readwrite');
        const store = tx.objectStore('mindsets');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const updated = { ...slogan, ...data, updatedAt: new Date().toISOString() };
      await update('mindsets', updated);
      return { slogan: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('mindsets', id);
    },
  },

  balanceWheel: {
    // 每条生活领域评分独立存储，对齐远端契约（{ id, domainId, score, createdAt, domain }）
    async saveScores(scores: { domainId: string; score: number }[]): Promise<void> {
      const now = new Date().toISOString();
      for (const s of scores) {
        const row: BalanceWheelScoreRow = {
          id: generateId(),
          userId: currentUserId || '',
          domainId: s.domainId,
          score: s.score,
          createdAt: now,
        };
        await add('balanceWheel', row);
      }
    },

    async getHistory(limit?: number): Promise<{ scores: BalanceWheelScoreRow[] }> {
      const rows = currentUserId
        ? await getByIndex<BalanceWheelScoreRow | LegacyBalanceWheelRecord>('balanceWheel', 'userId', currentUserId)
        : [];
      const scores: BalanceWheelScoreRow[] = [];
      for (const row of rows) {
        if ('domainId' in row) {
          scores.push(row);
        } else if (Array.isArray(row.scores)) {
          // 旧格式：一次提交含数组，读时展开为逐条
          for (const s of row.scores) {
            scores.push({
              id: `${row.id}:${s.domainId}`,
              userId: row.userId,
              domainId: s.domainId,
              score: s.score,
              createdAt: row.createdAt,
            });
          }
        }
      }
      scores.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const domains = currentUserId
        ? await getByIndex<Domain>('domains', 'userId', currentUserId)
        : [];
      const byId = new Map(domains.map((d) => [d.id, d]));
      for (const row of scores) {
        const domain = byId.get(row.domainId);
        if (domain) row.domain = { id: domain.id, name: domain.name, icon: domain.icon };
      }
      return { scores: limit ? scores.slice(0, limit) : scores };
    },

    async deleteRecord(id: string): Promise<void> {
      if (!id.includes(':')) {
        await remove('balanceWheel', id);
        return;
      }
      // 旧格式展开出的合成 id（recordId:domainId）：从原提交记录中移除该领域评分
      const [recordId, domainId] = id.split(':');
      const db = await openDB();
      const legacy = await new Promise<LegacyBalanceWheelRecord | undefined>((resolve, reject) => {
        const tx = db.transaction('balanceWheel', 'readwrite');
        const store = tx.objectStore('balanceWheel');
        const request = store.get(recordId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!legacy || !Array.isArray(legacy.scores)) return;
      const rest = legacy.scores.filter((s) => s.domainId !== domainId);
      if (rest.length === 0) {
        await remove('balanceWheel', recordId);
      } else {
        await update('balanceWheel', { ...legacy, scores: rest });
      }
    },
  },

  reflections: {
    async getAll(): Promise<{ reflections: Reflection[] }> {
      const reflections = currentUserId
        ? await getByIndex<Reflection>('reflections', 'userId', currentUserId)
        : [];
      return { reflections };
    },

    async create(data: Record<string, unknown>): Promise<{ reflection: Reflection }> {
      const now = new Date().toISOString();
      const d = data as Partial<Reflection>;
      const reflection: Reflection = {
        id: generateId(),
        userId: currentUserId || '',
        content: d.content || '',
        date: d.date || now,
        mood: d.mood,
        celebrations: d.celebrations,
        improvements: d.improvements,
        tomorrow: d.tomorrow,
        tags: d.tags,
        createdAt: now,
        updatedAt: now,
      };
      await add('reflections', reflection);
      return { reflection };
    },

    async update(id: string, data: Partial<Reflection>): Promise<{ reflection: Reflection }> {
      const db = await openDB();
      const reflection = await new Promise<Reflection>((resolve, reject) => {
        const tx = db.transaction('reflections', 'readwrite');
        const store = tx.objectStore('reflections');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...reflection, ...data, updatedAt: new Date().toISOString() };
      await update('reflections', updated);
      return { reflection: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('reflections', id);
    },

    async getTodaySummary(date?: string): Promise<TodaySummary> {
      const parsed = date ? new Date(`${date}T00:00:00`) : new Date();
      const dayStart = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayKey = localDateKey(dayStart);

      const inDay = (iso?: string) => {
        if (!iso) return false;
        const t = new Date(iso).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      };

      const todos = currentUserId ? await getByIndex<Todo>('todos', 'userId', currentUserId) : [];
      const todosDone = todos.filter((t) => inDay(t.completedAt));
      const todosCreated = todos.filter((t) => inDay(t.createdAt)).length;

      const habits = currentUserId ? await getByIndex<Habit>('habits', 'userId', currentUserId) : [];
      const habitTitles: string[] = [];
      for (const habit of habits) {
        const logs = await getByIndex<HabitLog>('habitLogs', 'habitId', habit.id);
        if (logs.some((l) => l.date === dayKey || inDay(l.date))) habitTitles.push(habit.title);
      }

      const healthRecords = (
        currentUserId ? await getByIndex<HealthRecord>('healthRecords', 'userId', currentUserId) : []
      ).filter((r) => inDay(r.recordedAt || r.date));

      const lines: string[] = [];
      if (todosDone.length > 0) {
        lines.push(`待办完成 ${todosDone.length} 条${todosCreated > 0 ? `（今日新增 ${todosCreated} 条）` : ''}`);
      }
      if (habitTitles.length > 0) {
        lines.push(`习惯打卡 ${habitTitles.length} 项（${habitTitles.join('、')}）`);
      }
      if (healthRecords.length > 0) {
        lines.push(`健康记录 ${healthRecords.length} 条（${healthRecords.map(formatHealthItem).join('、')}）`);
      }

      return {
        date: dayKey,
        todos: { total: todosDone.length, createdToday: todosCreated, items: todosDone.map((t) => t.title) },
        habits: { total: habitTitles.length, items: habitTitles },
        health: {
          total: healthRecords.length,
          items: healthRecords.map((r) => ({ type: r.type, value: r.value, unit: r.unit, label: formatHealthItem(r) })),
        },
        summary: lines.join('；'),
      };
    },
  },

  reviews: {
    async getAll(): Promise<{ reviews: Review[] }> {
      const reviews = currentUserId
        ? await getByIndex<Review>('reviews', 'userId', currentUserId)
        : [];
      return { reviews };
    },

    async create(data: Record<string, unknown>): Promise<{ review: Review }> {
      const now = new Date().toISOString();
      const d = data as Partial<Review>;
      const review: Review = {
        id: generateId(),
        userId: currentUserId || '',
        period: d.period || 'weekly',
        content: d.content || '',
        startDate: d.startDate,
        endDate: d.endDate,
        highlights: d.highlights,
        lowlights: d.lowlights,
        learnings: d.learnings,
        nextActions: d.nextActions,
        createdAt: now,
        updatedAt: now,
      };
      await add('reviews', review);
      return { review };
    },

    async update(id: string, data: Partial<Review>): Promise<{ review: Review }> {
      const db = await openDB();
      const review = await new Promise<Review>((resolve, reject) => {
        const tx = db.transaction('reviews', 'readwrite');
        const store = tx.objectStore('reviews');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...review, ...data, updatedAt: new Date().toISOString() };
      await update('reviews', updated);
      return { review: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('reviews', id);
    },
  },

  insights: {
    async getAll(): Promise<{ insights: Insight[] }> {
      const insights = currentUserId
        ? await getByIndex<Insight>('insights', 'userId', currentUserId)
        : [];
      return { insights };
    },

    async create(data: Record<string, unknown>): Promise<{ insight: Insight }> {
      const now = new Date().toISOString();
      const d = data as Partial<Insight>;
      const insight: Insight = {
        id: generateId(),
        userId: currentUserId || '',
        title: d.title || '',
        content: d.content || '',
        tags: d.tags ? JSON.stringify(d.tags) : null,
        category: d.category || null,
        createdAt: now,
        updatedAt: now,
      };
      await add('insights', insight);
      return { insight };
    },

    async update(id: string, data: Partial<Insight>): Promise<{ insight: Insight }> {
      const db = await openDB();
      const insight = await new Promise<Insight>((resolve, reject) => {
        const tx = db.transaction('insights', 'readwrite');
        const store = tx.objectStore('insights');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...insight, ...data, updatedAt: new Date().toISOString() };
      if (data.tags) updated.tags = JSON.stringify(data.tags);
      await update('insights', updated);
      return { insight: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('insights', id);
    },
  },

  topics: {
    async getAll(): Promise<{ topics: Topic[] }> {
      const topics = currentUserId
        ? await getByIndex<Topic>('topics', 'userId', currentUserId)
        : [];
      return { topics };
    },

    async create(data: { title: string; description?: string; category: string; status: string; priority: string; currentUnderstanding?: string; actionPlan?: string }): Promise<{ topic: Topic }> {
      const now = new Date().toISOString();
      const topic: Topic = {
        id: generateId(),
        userId: currentUserId || '',
        title: data.title,
        description: data.description,
        category: data.category,
        status: data.status,
        priority: data.priority,
        currentUnderstanding: data.currentUnderstanding,
        actionPlan: data.actionPlan,
        notes: [],
        order: 0,
        createdAt: now,
        updatedAt: now,
      };
      await add('topics', topic);
      return { topic };
    },

    async update(id: string, data: Partial<Topic>): Promise<{ topic: Topic }> {
      const db = await openDB();
      const topic = await new Promise<Topic>((resolve, reject) => {
        const tx = db.transaction('topics', 'readwrite');
        const store = tx.objectStore('topics');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...topic, ...data, updatedAt: new Date().toISOString() };
      await update('topics', updated);
      return { topic: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('topics', id);
    },

    async addNote(topicId: string, data: { content: string; noteType?: string }): Promise<{ note: TopicNote }> {
      const note: TopicNote = {
        id: generateId(),
        topicId,
        userId: currentUserId || '',
        content: data.content,
        noteType: data.noteType || 'reflection',
        createdAt: new Date().toISOString(),
      };
      await add('topicNotes', note);

      const db = await openDB();
      const topic = await new Promise<Topic>((resolve, reject) => {
        const tx = db.transaction('topics', 'readwrite');
        const store = tx.objectStore('topics');
        const request = store.get(topicId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...topic, notes: [...topic.notes, note], updatedAt: new Date().toISOString() };
      await update('topics', updated);
      return { note };
    },

    async deleteNote(noteId: string): Promise<void> {
      const db = await openDB();
      const note = await new Promise<TopicNote | undefined>((resolve, reject) => {
        const tx = db.transaction('topicNotes', 'readonly');
        const store = tx.objectStore('topicNotes');
        const request = store.get(noteId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!note) return;
      await remove('topicNotes', noteId);

      const topic = await new Promise<Topic | undefined>((resolve, reject) => {
        const tx = db.transaction('topics', 'readonly');
        const store = tx.objectStore('topics');
        const request = store.get(note.topicId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (topic) {
        await update('topics', {
          ...topic,
          notes: topic.notes.filter((n) => n.id !== noteId),
          updatedAt: new Date().toISOString(),
        });
      }
    },
  },

  todos: {
    async getAll(): Promise<{ todos: Todo[] }> {
      const todos = currentUserId
        ? await getByIndex<Todo>('todos', 'userId', currentUserId)
        : [];
      return { todos };
    },

    async create(data: { title: string; description?: string; priority?: string; status?: string }): Promise<{ todo: Todo }> {
      const todo: Todo = {
        id: generateId(),
        userId: currentUserId || '',
        title: data.title,
        description: data.description,
        priority: (data.priority as Todo['priority']) || 'medium',
        status: (data.status as Todo['status']) || 'inbox',
        createdAt: new Date().toISOString(),
      };
      await add('todos', todo);
      return { todo };
    },

    async update(id: string, data: Partial<Todo>): Promise<{ todo: Todo }> {
      const db = await openDB();
      const todo = await new Promise<Todo>((resolve, reject) => {
        const tx = db.transaction('todos', 'readwrite');
        const store = tx.objectStore('todos');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...todo, ...data };
      await update('todos', updated);
      return { todo: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('todos', id);
    },
  },

  habits: {
    async getAll(): Promise<{ habits: (Habit & { logs: HabitLog[] })[] }> {
      const habits = currentUserId
        ? await getByIndex<Habit>('habits', 'userId', currentUserId)
        : [];
      const withLogs = await Promise.all(
        habits.map(async (habit) => {
          const logs = await getByIndex<HabitLog>('habitLogs', 'habitId', habit.id);
          return { ...habit, logs };
        })
      );
      return { habits: withLogs };
    },

    async create(data: { title: string; description?: string; frequency?: string; color?: string }): Promise<{ habit: Habit }> {
      const habit: Habit = {
        id: generateId(),
        userId: currentUserId || '',
        title: data.title,
        description: data.description,
        frequency: (data.frequency as Habit['frequency']) || 'daily',
        color: data.color || '#3B82F6',
        isActive: true,
        order: 0,
        createdAt: new Date().toISOString(),
      };
      await add('habits', habit);
      return { habit };
    },

    async update(id: string, data: Partial<Habit>): Promise<{ habit: Habit }> {
      const db = await openDB();
      const habit = await new Promise<Habit>((resolve, reject) => {
        const tx = db.transaction('habits', 'readwrite');
        const store = tx.objectStore('habits');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...habit, ...data };
      await update('habits', updated);
      return { habit: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('habits', id);
    },

    async toggleLog(habitId: string, data: { date: string }): Promise<{ logged: boolean }> {
      const db = await openDB();
      const logs = await new Promise<HabitLog[]>((resolve, reject) => {
        const tx = db.transaction('habitLogs', 'readonly');
        const store = tx.objectStore('habitLogs');
        const index = store.index('habitId');
        const request = index.getAll(habitId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const existing = logs.find(l => l.date === data.date);
      if (existing) {
        await remove('habitLogs', existing.id);
        return { logged: false };
      }
      const log: HabitLog = { id: generateId(), habitId, date: data.date };
      await add('habitLogs', log);
      return { logged: true };
    },
  },

  goals: {
    async getAll(): Promise<{ goals: (Goal & { keyResults: KeyResult[] })[] }> {
      const goals = currentUserId
        ? await getByIndex<Goal>('goals', 'userId', currentUserId)
        : [];
      const withKRs = await Promise.all(
        goals.map(async (goal) => {
          const keyResults = await getByIndex<KeyResult>('keyResults', 'goalId', goal.id);
          return { ...goal, keyResults };
        })
      );
      return { goals: withKRs };
    },

    async create(data: Record<string, unknown>): Promise<{ goal: Goal }> {
      const now = new Date().toISOString();
      const d = data as Partial<Goal>;
      const goal: Goal = {
        id: generateId(),
        userId: currentUserId || '',
        title: d.title || '',
        description: d.description,
        domainId: d.domainId,
        status: d.status || 'active',
        priority: d.priority || 'medium',
        startDate: d.startDate,
        endDate: d.endDate,
        deadline: d.deadline,
        createdAt: now,
        updatedAt: now,
      };
      await add('goals', goal);
      return { goal };
    },

    async update(id: string, data: Partial<Goal>): Promise<{ goal: Goal }> {
      const db = await openDB();
      const goal = await new Promise<Goal>((resolve, reject) => {
        const tx = db.transaction('goals', 'readwrite');
        const store = tx.objectStore('goals');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...goal, ...data, updatedAt: new Date().toISOString() };
      await update('goals', updated);
      return { goal: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('goals', id);
      const krs = await getByIndex<KeyResult>('keyResults', 'goalId', id);
      for (const kr of krs) {
        await remove('keyResults', kr.id);
      }
    },

    async createKeyResult(goalId: string, data: Record<string, unknown>): Promise<{ keyResult: KeyResult }> {
      const now = new Date().toISOString();
      const d = data as Partial<KeyResult>;
      const kr: KeyResult = {
        id: generateId(),
        goalId,
        userId: currentUserId || '',
        title: d.title || '',
        targetValue: d.targetValue || 0,
        currentValue: d.currentValue || 0,
        unit: d.unit || '',
        order: d.order || 0,
        createdAt: now,
        updatedAt: now,
      };
      await add('keyResults', kr);
      return { keyResult: kr };
    },

    async updateKeyResult(krId: string, data: Partial<KeyResult>): Promise<{ keyResult: KeyResult }> {
      const db = await openDB();
      const kr = await new Promise<KeyResult>((resolve, reject) => {
        const tx = db.transaction('keyResults', 'readwrite');
        const store = tx.objectStore('keyResults');
        const request = store.get(krId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...kr, ...data, updatedAt: new Date().toISOString() };
      await update('keyResults', updated);
      return { keyResult: updated };
    },

    async deleteKeyResult(krId: string): Promise<void> {
      await remove('keyResults', krId);
    },
  },

  visions: {
    async getActive(): Promise<{ vision: Vision | null }> {
      const visions = currentUserId
        ? await getByIndex<Vision>('visions', 'userId', currentUserId)
        : [];
      const active = visions.find((v) => v.isActive) || visions[visions.length - 1] || null;
      return { vision: active };
    },

    async create(data: { content: string }): Promise<{ vision: Vision }> {
      const now = new Date().toISOString();
      const visions = currentUserId
        ? await getByIndex<Vision>('visions', 'userId', currentUserId)
        : [];
      const latestVersion = visions.reduce((max, v) => Math.max(max, v.version), 0);

      for (const v of visions) {
        if (v.isActive) {
          v.isActive = false;
          await update('visions', v);
        }
      }

      const vision: Vision = {
        id: generateId(),
        userId: currentUserId || '',
        content: data.content,
        version: latestVersion + 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await add('visions', vision);
      return { vision };
    },

    async update(id: string, data: Partial<Vision>): Promise<{ vision: Vision }> {
      const db = await openDB();
      const vision = await new Promise<Vision>((resolve, reject) => {
        const tx = db.transaction('visions', 'readwrite');
        const store = tx.objectStore('visions');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (data.isActive) {
        const visions = currentUserId
          ? await getByIndex<Vision>('visions', 'userId', currentUserId)
          : [];
        for (const v of visions) {
          if (v.id !== id && v.isActive) {
            v.isActive = false;
            await update('visions', v);
          }
        }
      }

      const updated = { ...vision, ...data, updatedAt: new Date().toISOString() };
      await update('visions', updated);
      return { vision: updated };
    },

    async getHistory(): Promise<{ visions: Vision[] }> {
      const visions = currentUserId
        ? await getByIndex<Vision>('visions', 'userId', currentUserId)
        : [];
      return { visions: visions.sort((a, b) => b.version - a.version) };
    },
  },

  contacts: {
    async getAll(): Promise<{ contacts: Contact[] }> {
      const contacts = currentUserId
        ? await getByIndex<Contact>('contacts', 'userId', currentUserId)
        : [];
      return { contacts };
    },

    async create(data: Record<string, unknown>): Promise<{ contact: Contact }> {
      const now = new Date().toISOString();
      const d = data as Partial<Contact>;
      const contact: Contact = {
        id: generateId(),
        userId: currentUserId || '',
        name: d.name || '',
        email: d.email,
        phone: d.phone,
        role: d.role,
        company: d.company,
        tags: d.tags || [],
        notes: d.notes,
        lastContact: d.lastContact,
        domainId: d.domainId,
        createdAt: now,
        updatedAt: now,
      };
      await add('contacts', contact);
      return { contact };
    },

    async update(id: string, data: Partial<Contact>): Promise<{ contact: Contact }> {
      const db = await openDB();
      const contact = await new Promise<Contact>((resolve, reject) => {
        const tx = db.transaction('contacts', 'readwrite');
        const store = tx.objectStore('contacts');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...contact, ...data, updatedAt: new Date().toISOString() };
      await update('contacts', updated);
      return { contact: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('contacts', id);
    },

    async touch(id: string): Promise<void> {
      const db = await openDB();
      const contact = await new Promise<Contact>((resolve, reject) => {
        const tx = db.transaction('contacts', 'readwrite');
        const store = tx.objectStore('contacts');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      contact.lastContact = new Date().toISOString();
      contact.updatedAt = new Date().toISOString();
      await update('contacts', contact);
    },
  },

  readingItems: {
    async getAll(): Promise<{ items: ReadingItem[] }> {
      const items = currentUserId
        ? await getByIndex<ReadingItem>('readingItems', 'userId', currentUserId)
        : [];
      return { items };
    },

    async create(data: Record<string, unknown>): Promise<{ item: ReadingItem }> {
      const now = new Date().toISOString();
      const d = data as Partial<ReadingItem>;
      const item: ReadingItem = {
        id: generateId(),
        userId: currentUserId || '',
        title: d.title || '',
        author: d.author,
        type: d.type || 'book',
        status: d.status || 'want',
        url: d.url,
        note: d.note,
        rating: d.rating,
        topicId: d.topicId,
        startDate: d.startDate,
        endDate: d.endDate,
        createdAt: now,
        updatedAt: now,
      };
      await add('readingItems', item);
      return { item };
    },

    async update(id: string, data: Partial<ReadingItem>): Promise<{ item: ReadingItem }> {
      const db = await openDB();
      const item = await new Promise<ReadingItem>((resolve, reject) => {
        const tx = db.transaction('readingItems', 'readwrite');
        const store = tx.objectStore('readingItems');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...item, ...data, updatedAt: new Date().toISOString() };
      await update('readingItems', updated);
      return { item: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('readingItems', id);
    },
  },

  healthRecords: {
    async getAll(type?: string): Promise<{ records: HealthRecord[] }> {
      let records = currentUserId
        ? await getByIndex<HealthRecord>('healthRecords', 'userId', currentUserId)
        : [];
      if (type) records = records.filter((r) => r.type === type);
      return { records: records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) };
    },

    async create(data: Record<string, unknown>): Promise<{ record: HealthRecord }> {
      const now = new Date().toISOString();
      const d = data as Partial<HealthRecord>;
      const record: HealthRecord = {
        id: generateId(),
        userId: currentUserId || '',
        type: d.type || 'weight',
        value: d.value || 0,
        unit: d.unit || '',
        note: d.note,
        date: d.date || now,
        recordedAt: d.recordedAt || now,
        createdAt: now,
      };
      await add('healthRecords', record);
      return { record };
    },

    async update(id: string, data: Partial<HealthRecord>): Promise<{ record: HealthRecord }> {
      const db = await openDB();
      const record = await new Promise<HealthRecord>((resolve, reject) => {
        const tx = db.transaction('healthRecords', 'readwrite');
        const store = tx.objectStore('healthRecords');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...record, ...data };
      await update('healthRecords', updated);
      return { record: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('healthRecords', id);
    },

    async getSummary(days: number = 7): Promise<Record<string, { avg: number; count: number; latest: number }>> {
      const records = currentUserId
        ? await getByIndex<HealthRecord>('healthRecords', 'userId', currentUserId)
        : [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const recent = records.filter((r) => new Date(r.date) >= cutoff);

      const summary: Record<string, { avg: number; count: number; latest: number }> = {};
      const byType: Record<string, HealthRecord[]> = {};
      for (const r of recent) {
        if (!byType[r.type]) byType[r.type] = [];
        byType[r.type].push(r);
      }
      for (const [type, items] of Object.entries(byType)) {
        const values = items.map((i) => i.value);
        summary[type] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          count: values.length,
          latest: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.value || 0,
        };
      }
      return summary;
    },
  },

  subscriptions: {
    async getAll(): Promise<{ subscriptions: Subscription[] }> {
      const subscriptions = currentUserId
        ? await getByIndex<Subscription>('subscriptions', 'userId', currentUserId)
        : [];
      return { subscriptions };
    },

    async getOne(id: string): Promise<{ subscription: Subscription; currentUsage: MonthlyUsage | null }> {
      const db = await openDB();
      const subscription = await new Promise<Subscription>((resolve, reject) => {
        const tx = db.transaction('subscriptions', 'readonly');
        const store = tx.objectStore('subscriptions');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const now = new Date();
      const usages = currentUserId
        ? await getByIndex<MonthlyUsage>('monthlyUsage', 'userId', currentUserId)
        : [];
      const currentUsage = usages.find((u) => u.subscriptionId === id && u.year === now.getFullYear() && u.month === now.getMonth() + 1) || null;
      return { subscription, currentUsage };
    },

    async create(data: Partial<Subscription>): Promise<{ subscription: Subscription }> {
      const now = new Date().toISOString();
      const subscription: Subscription = {
        id: generateId(),
        userId: currentUserId || '',
        name: data.name || '',
        provider: data.provider || '',
        billingCycle: data.billingCycle || 'monthly',
        costPerCycle: data.costPerCycle || 0,
        currency: data.currency || 'CNY',
        startDate: data.startDate || now,
        isActive: data.isActive ?? true,
        autoRenew: data.autoRenew ?? false,
        websiteUrl: data.websiteUrl,
        notes: data.notes,
        config: data.config,
        quotas: data.quotas || [],
        createdAt: now,
        updatedAt: now,
      };
      await add('subscriptions', subscription);
      return { subscription };
    },

    async update(id: string, data: Partial<Subscription>): Promise<{ subscription: Subscription }> {
      const db = await openDB();
      const subscription = await new Promise<Subscription>((resolve, reject) => {
        const tx = db.transaction('subscriptions', 'readwrite');
        const store = tx.objectStore('subscriptions');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const updated = { ...subscription, ...data, updatedAt: new Date().toISOString() };
      await update('subscriptions', updated);
      return { subscription: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('subscriptions', id);
    },

    async addQuota(subscriptionId: string, data: Partial<QuotaDefinition>): Promise<{ quota: QuotaDefinition }> {
      const quota: QuotaDefinition = {
        id: generateId(),
        subscriptionId,
        name: data.name || '',
        unit: data.unit || '',
        monthlyLimit: data.monthlyLimit || 0,
        warningThreshold: data.warningThreshold || 80,
        criticalThreshold: data.criticalThreshold || 95,
        order: data.order || 0,
        quotaType: data.quotaType || 'counter',
      };

      const db = await openDB();
      const subscription = await new Promise<Subscription>((resolve, reject) => {
        const tx = db.transaction('subscriptions', 'readwrite');
        const store = tx.objectStore('subscriptions');
        const request = store.get(subscriptionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      subscription.quotas.push(quota);
      subscription.updatedAt = new Date().toISOString();
      await update('subscriptions', subscription);
      return { quota };
    },

    async updateQuota(subscriptionId: string, quotaId: string, data: Partial<QuotaDefinition>): Promise<{ quota: QuotaDefinition }> {
      const db = await openDB();
      const subscription = await new Promise<Subscription>((resolve, reject) => {
        const tx = db.transaction('subscriptions', 'readwrite');
        const store = tx.objectStore('subscriptions');
        const request = store.get(subscriptionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const quotaIndex = subscription.quotas.findIndex((q) => q.id === quotaId);
      if (quotaIndex === -1) throw new Error('Quota not found');

      subscription.quotas[quotaIndex] = { ...subscription.quotas[quotaIndex], ...data };
      subscription.updatedAt = new Date().toISOString();
      await update('subscriptions', subscription);
      return { quota: subscription.quotas[quotaIndex] };
    },

    async deleteQuota(subscriptionId: string, quotaId: string): Promise<void> {
      const db = await openDB();
      const subscription = await new Promise<Subscription>((resolve, reject) => {
        const tx = db.transaction('subscriptions', 'readwrite');
        const store = tx.objectStore('subscriptions');
        const request = store.get(subscriptionId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      subscription.quotas = subscription.quotas.filter((q) => q.id !== quotaId);
      subscription.updatedAt = new Date().toISOString();
      await update('subscriptions', subscription);
    },

    async recordUsage(
      subscriptionId: string,
      year: number,
      month: number,
      data: { notes?: string; quotaUsages: { quotaDefinitionId: string; usedAmount: number }[] }
    ): Promise<{ monthlyUsage: MonthlyUsage }> {
      // 同一订阅同一年月重复提交时更新原记录（对齐远端 upsert 语义）
      const usages = currentUserId
        ? await getByIndex<MonthlyUsage>('monthlyUsage', 'userId', currentUserId)
        : [];
      const existing = usages.find((u) => u.subscriptionId === subscriptionId && u.year === year && u.month === month);
      const id = existing ? existing.id : generateId();
      const usage: MonthlyUsage = {
        id,
        subscriptionId,
        userId: currentUserId || '',
        year,
        month,
        notes: data.notes,
        quotaUsages: data.quotaUsages.map((u) => ({
          id: generateId(),
          monthlyUsageId: id,
          quotaDefinitionId: u.quotaDefinitionId,
          usedAmount: u.usedAmount,
        })),
      };
      if (existing) {
        await update('monthlyUsage', usage);
      } else {
        await add('monthlyUsage', usage);
      }
      return { monthlyUsage: usage };
    },

    async getDashboardSummary(): Promise<SubscriptionDashboardSummary> {
      const subscriptions = currentUserId
        ? await getByIndex<Subscription>('subscriptions', 'userId', currentUserId)
        : [];

      const activeSubscriptions = subscriptions.filter((s) => s.isActive);

      return {
        subscriptions: activeSubscriptions.map((s) => ({
          id: s.id,
          name: s.name,
          provider: s.provider,
          monthlyCost: s.billingCycle === 'monthly' ? s.costPerCycle : s.costPerCycle / 12,
          currency: s.currency,
          overallUtilization: 0,
          quotaUtilization: [],
          daysUntilRenewal: 30,
          isActive: s.isActive,
          autoRenew: s.autoRenew,
          mock: s.mock,
        })),
        stats: {
          totalMonthlySpend: activeSubscriptions.reduce((sum, s) => {
            const monthly = s.billingCycle === 'monthly' ? s.costPerCycle : s.costPerCycle / 12;
            return sum + monthly;
          }, 0),
          activeCount: activeSubscriptions.length,
          nearLimitCount: 0,
          criticalCount: 0,
        },
      };
    },
  },

  workflows: {
    async getAll(): Promise<{ workflows: Workflow[] }> {
      const workflows = currentUserId
        ? await getByIndex<Workflow>('workflows', 'userId', currentUserId)
        : [];
      return { workflows };
    },

    async create(data: { name: string; description?: string }): Promise<{ workflow: Workflow }> {
      const now = new Date().toISOString();
      const workflow: Workflow = {
        id: generateId(),
        userId: currentUserId || '',
        name: data.name,
        description: data.description,
        steps: [],
        connections: [],
        createdAt: now,
        updatedAt: now,
      };
      await add('workflows', workflow);
      return { workflow };
    },

    async update(id: string, data: Partial<Workflow>): Promise<{ workflow: Workflow }> {
      const db = await openDB();
      const workflow = await new Promise<Workflow>((resolve, reject) => {
        const tx = db.transaction('workflows', 'readwrite');
        const store = tx.objectStore('workflows');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...workflow, ...data, updatedAt: new Date().toISOString() };
      await update('workflows', updated);
      return { workflow: updated };
    },

    async delete(id: string): Promise<void> {
      await remove('workflows', id);
    },

    async getOne(id: string): Promise<{ workflow: Workflow | null }> {
      const db = await openDB();
      const workflow = await new Promise<Workflow | undefined>((resolve, reject) => {
        const tx = db.transaction('workflows', 'readonly');
        const store = tx.objectStore('workflows');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (!workflow) return { workflow: null };

      const [steps, connections] = await Promise.all([
        getByIndex<WorkflowStep>('workflowSteps', 'workflowId', id),
        getByIndex<WorkflowConnection>('workflowConnections', 'workflowId', id),
      ]);

      return { workflow: { ...workflow, steps, connections } };
    },

    async addStep(workflowId: string, data: { entityType: string; entityId: string; label: string; positionX: number; positionY: number }): Promise<{ step: WorkflowStep }> {
      const step: WorkflowStep = {
        id: generateId(),
        workflowId,
        entityType: data.entityType as 'vision' | 'goal' | 'keyResult' | 'todo' | 'habit',
        entityId: data.entityId,
        label: data.label,
        positionX: data.positionX,
        positionY: data.positionY,
        width: 200,
        height: 80,
        createdAt: new Date().toISOString(),
      };
      await add('workflowSteps', step);
      return { step };
    },

    async updateStep(stepId: string, data: Partial<WorkflowStep>): Promise<{ step: WorkflowStep }> {
      const db = await openDB();
      const step = await new Promise<WorkflowStep>((resolve, reject) => {
        const tx = db.transaction('workflowSteps', 'readwrite');
        const store = tx.objectStore('workflowSteps');
        const request = store.get(stepId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const updated = { ...step, ...data };
      await update('workflowSteps', updated);
      return { step: updated };
    },

    async deleteStep(stepId: string): Promise<void> {
      await remove('workflowSteps', stepId);
    },

    async addConnection(workflowId: string, data: { sourceStepId: string; targetStepId: string }): Promise<{ connection: WorkflowConnection }> {
      const connection: WorkflowConnection = {
        id: generateId(),
        workflowId,
        sourceStepId: data.sourceStepId,
        targetStepId: data.targetStepId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        createdAt: new Date().toISOString(),
      };
      await add('workflowConnections', connection);
      return { connection };
    },

    async deleteConnection(connId: string): Promise<void> {
      await remove('workflowConnections', connId);
    },
  },
};

async function createDefaultDomains(userId: string) {
  const defaultDomains: Omit<Domain, 'id' | 'userId'>[] = [
    { name: '工作 Career', icon: 'career', identifier: 'career', color: '#0ea5e9', weight: 10, score: 5, order: 0, description: '职业发展与工作成就' },
    { name: '财务 Finance', icon: 'finance', identifier: 'finance', color: '#22c55e', weight: 8, score: 5, order: 1, description: '收入、储蓄与理财' },
    { name: '健康 Health', icon: 'health', identifier: 'health', color: '#ef4444', weight: 9, score: 5, order: 2, description: '身体与心理健康' },
    { name: '家庭 Family', icon: 'family', identifier: 'family', color: '#f97316', weight: 10, score: 5, order: 3, description: '家人与家庭关系' },
    { name: '社交 Social', icon: 'social', identifier: 'social', color: '#a855f7', weight: 7, score: 5, order: 4, description: '朋友与人际关系' },
    { name: '个人成长 Learning', icon: 'learning', identifier: 'learning', color: '#eab308', weight: 8, score: 5, order: 5, description: '知识、技能与认知提升' },
    { name: '娱乐休闲 Entertainment', icon: 'leisure', identifier: 'entertainment', color: '#ec4899', weight: 6, score: 5, order: 6, description: '爱好、娱乐与放松' },
    { name: '环境与物资 Environment', icon: 'flower', identifier: 'environment', color: '#14b8a6', weight: 6, score: 5, order: 7, description: '居住环境与物质管理' },
  ];

  for (const domain of defaultDomains) {
    const fullDomain: Domain = { ...domain, id: generateId(), userId };
    await add('domains', fullDomain);
  }
}
