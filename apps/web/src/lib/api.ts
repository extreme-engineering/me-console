import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { localDB } from './localDB';
import { supabaseAdapter } from './supabaseAdapter';

const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage;
const dataMode =
  isChromeExtension ? 'local'
  : import.meta.env.VITE_USE_REMOTE === '1' ? 'remote'
  : 'supabase';

const remoteApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

remoteApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

remoteApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

interface LocalDBAdapter {
  get(url: string): Promise<{ data: unknown }>;
  post(url: string, data?: unknown): Promise<{ data: unknown }>;
  patch(url: string, data?: unknown): Promise<{ data: unknown }>;
  delete(url: string): Promise<{ data: unknown }>;
  request(url: string, method?: 'GET' | 'POST' | 'PATCH' | 'DELETE', data?: unknown): Promise<unknown>;
  handleAuth(segments: string[], data?: unknown): Promise<unknown>;
}

const localDBAdapter: LocalDBAdapter = {
  async get(url: string) {
    const result = await this.request(url, 'GET');
    return { data: result };
  },

  async post(url: string, data?: unknown) {
    const result = await this.request(url, 'POST', data);
    return { data: result };
  },

  async patch(url: string, data?: unknown) {
    const result = await this.request(url, 'PATCH', data);
    return { data: result };
  },

  async delete(url: string) {
    const result = await this.request(url, 'DELETE');
    return { data: result };
  },

  async request(url: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', data?: unknown) {
    const [path, queryStr] = url.split('?');
    const segments = path.split('/').filter(Boolean);
    const entity = segments[0];
    const id = segments[1];

    const query: Record<string, string> = {};
    if (queryStr) {
      for (const pair of queryStr.split('&')) {
        const [k, v] = pair.split('=');
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }

    if (url.startsWith('/auth/')) {
      return this.handleAuth(segments, data);
    }

    const userId = localDB.auth.getCurrentUserId();
    if (!userId) {
      throw { response: { data: { error: '请先登录' } } };
    }

    const handler = routeHandlers[entity];
    if (handler) {
      return handler(method, id, segments, data, localDB, query);
    }

    throw { response: { data: { error: `Unhandled localDB request: ${method} ${url}` } } };
  },

  async handleAuth(segments: string[], data: unknown) {
    const action = segments[1];
    const authData = data as Record<string, string>;
    switch (action) {
      case 'login': {
        const result = await localDB.auth.login(authData.email, authData.password);
        localDB.auth.setCurrentUserId(result.user.id);
        return result;
      }
      case 'register': {
        const result = await localDB.auth.register(authData.name, authData.email, authData.password);
        localDB.auth.setCurrentUserId(result.user.id);
        return result;
      }
      case 'me': {
        const user = await localDB.auth.getCurrentUser();
        if (!user) throw { response: { data: { error: 'Not authenticated' } } };
        return { user };
      }
      default:
        throw { response: { data: { error: `Unknown auth action: ${action}` } } };
    }
  },
};

const routeHandlers: Record<string, (method: string, id: string, segments: string[], data: unknown, db: typeof localDB, query?: Record<string, string>) => unknown> = {
  domains: (method, id, _s, data, db) => {
    if (method === 'GET') return db.domains.getAll();
    if (method === 'POST') return db.domains.create(data as Parameters<typeof db.domains.create>[0]);
    if (method === 'PATCH' && id) return db.domains.update(id, data as Parameters<typeof db.domains.update>[1]);
    if (method === 'DELETE' && id) { db.domains.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled domains: ${method}` } } };
  },

  mindsets: (method, id, _s, data, db) => {
    if (method === 'GET') return db.mindsets.getAll();
    if (method === 'POST') return db.mindsets.create(data as Parameters<typeof db.mindsets.create>[0]);
    if (method === 'PATCH' && id) return db.mindsets.update(id, data as Parameters<typeof db.mindsets.update>[1]);
    if (method === 'DELETE' && id) { db.mindsets.delete(id); return {}; }
    throw { response: { data: { error: `Unhandled mindsets: ${method}` } } };
  },

  'balance-wheel': (method, _id, segments, data, db, query) => {
    if (method === 'POST') {
      const payload = data as { scores: { domainId: string; score: number }[] };
      db.balanceWheel.saveScores(payload.scores);
      return {};
    }
    if (method === 'GET' && segments[1] === 'history') {
      return db.balanceWheel.getHistory(query?.limit ? parseInt(query.limit, 10) : undefined);
    }
    if (method === 'DELETE' && segments[1] === 'scores' && segments[2]) {
      db.balanceWheel.deleteRecord(segments[2]);
      return { success: true };
    }
    throw { response: { data: { error: `Unhandled balance-wheel: ${method}` } } };
  },

  reflections: (method, id, segments, data, db, query) => {
    if (method === 'GET' && segments[1] === 'today-summary') {
      return db.reflections.getTodaySummary(query?.date);
    }
    if (method === 'GET') return db.reflections.getAll();
    if (method === 'POST') return db.reflections.create(data as Parameters<typeof db.reflections.create>[0]);
    if (method === 'PATCH' && id) return db.reflections.update(id, data as Parameters<typeof db.reflections.update>[1]);
    if (method === 'DELETE' && id) { db.reflections.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled reflections: ${method}` } } };
  },

  reviews: (method, id, _s, data, db) => {
    if (method === 'GET') return db.reviews.getAll();
    if (method === 'POST') return db.reviews.create(data as Parameters<typeof db.reviews.create>[0]);
    if (method === 'PATCH' && id) return db.reviews.update(id, data as Parameters<typeof db.reviews.update>[1]);
    if (method === 'DELETE' && id) { db.reviews.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled reviews: ${method}` } } };
  },

  insights: (method, id, _s, data, db) => {
    if (method === 'GET') return db.insights.getAll();
    if (method === 'POST') return db.insights.create(data as Parameters<typeof db.insights.create>[0]);
    if (method === 'PATCH' && id) return db.insights.update(id, data as Parameters<typeof db.insights.update>[1]);
    if (method === 'DELETE' && id) { db.insights.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled insights: ${method}` } } };
  },

  subscriptions: (method, id, segments, data, db) => {
    if (method === 'GET' && segments[1] === 'dashboard' && segments[2] === 'summary') {
      return db.subscriptions.getDashboardSummary();
    }
    if (method === 'GET' && !id) return db.subscriptions.getAll();
    if (method === 'GET' && id) return db.subscriptions.getOne(id);
    if (method === 'POST' && !id) return db.subscriptions.create(data as Parameters<typeof db.subscriptions.create>[0]);
    if (method === 'POST' && id && segments[2] === 'quotas' && !segments[3]) {
      return db.subscriptions.addQuota(id, data as Parameters<typeof db.subscriptions.addQuota>[1]);
    }
    if (method === 'PATCH' && id) {
      if (segments[2] === 'quotas' && segments[3]) {
        return db.subscriptions.updateQuota(id, segments[3], data as Parameters<typeof db.subscriptions.updateQuota>[2]);
      }
      return db.subscriptions.update(id, data as Parameters<typeof db.subscriptions.update>[1]);
    }
    if (method === 'DELETE' && id) {
      if (segments[2] === 'quotas' && segments[3]) {
        db.subscriptions.deleteQuota(id, segments[3]);
        return {};
      }
      db.subscriptions.delete(id);
      return {};
    }
    if (method === 'POST' && id && segments[2] === 'usage') {
      return db.subscriptions.recordUsage(id, parseInt(segments[3]), parseInt(segments[4]), data as Parameters<typeof db.subscriptions.recordUsage>[3]);
    }
    throw { response: { data: { error: `Unhandled subscriptions: ${method}` } } };
  },

  topics: (method, id, segments, data, db) => {
    if (method === 'GET') return db.topics.getAll();
    if (method === 'POST' && !id) return db.topics.create(data as Parameters<typeof db.topics.create>[0]);
    if (method === 'POST' && id && segments[2] === 'notes') {
      return db.topics.addNote(id, data as Parameters<typeof db.topics.addNote>[1]);
    }
    if (method === 'PATCH' && id) return db.topics.update(id, data as Parameters<typeof db.topics.update>[1]);
    if (method === 'DELETE' && id && segments[2] === 'notes' && segments[3]) {
      db.topics.deleteNote(segments[3]);
      return { success: true };
    }
    if (method === 'DELETE' && id && !segments[2]) { db.topics.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled topics: ${method}` } } };
  },

  todos: (method, id, _s, data, db) => {
    if (method === 'GET') return db.todos.getAll();
    if (method === 'POST') return db.todos.create(data as Parameters<typeof db.todos.create>[0]);
    if (method === 'PATCH' && id) return db.todos.update(id, data as Parameters<typeof db.todos.update>[1]);
    if (method === 'DELETE' && id) { db.todos.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled todos: ${method}` } } };
  },

  habits: (method, id, segments, data, db) => {
    if (method === 'GET') return db.habits.getAll();
    if (method === 'POST' && !id) return db.habits.create(data as Parameters<typeof db.habits.create>[0]);
    if (method === 'POST' && id && segments[2] === 'log') {
      return db.habits.toggleLog(id, data as Parameters<typeof db.habits.toggleLog>[1]);
    }
    if (method === 'PATCH' && id) return db.habits.update(id, data as Parameters<typeof db.habits.update>[1]);
    if (method === 'DELETE' && id) { db.habits.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled habits: ${method}` } } };
  },

  goals: (method, id, segments, data, db) => {
    if (method === 'GET') return db.goals.getAll();
    if (method === 'POST' && !id) return db.goals.create(data as Parameters<typeof db.goals.create>[0]);
    if (method === 'PATCH' && id && !segments[2]) return db.goals.update(id, data as Parameters<typeof db.goals.update>[1]);
    if (method === 'DELETE' && id && !segments[2]) { db.goals.delete(id); return { success: true }; }
    if (method === 'POST' && id && segments[2] === 'key-results') return db.goals.createKeyResult(id, data as Parameters<typeof db.goals.createKeyResult>[1]);
    if (method === 'PATCH' && id && segments[2] === 'key-results' && segments[3]) return db.goals.updateKeyResult(segments[3], data as Parameters<typeof db.goals.updateKeyResult>[1]);
    if (method === 'DELETE' && id && segments[2] === 'key-results' && segments[3]) { db.goals.deleteKeyResult(segments[3]); return { success: true }; }
    throw { response: { data: { error: `Unhandled goals: ${method}` } } };
  },

  visions: (method, id, segments, data, db) => {
    if (method === 'GET' && !id) return db.visions.getActive();
    if (method === 'GET' && segments[1] === 'history') return db.visions.getHistory();
    if (method === 'POST') return db.visions.create(data as Parameters<typeof db.visions.create>[0]);
    if (method === 'PATCH' && id) return db.visions.update(id, data as Parameters<typeof db.visions.update>[1]);
    throw { response: { data: { error: `Unhandled visions: ${method}` } } };
  },

  contacts: (method, id, segments, data, db) => {
    if (method === 'GET') return db.contacts.getAll();
    if (method === 'POST' && !id) return db.contacts.create(data as Parameters<typeof db.contacts.create>[0]);
    if (method === 'POST' && id && segments[2] === 'touch') { db.contacts.touch(id); return { success: true }; }
    if (method === 'PATCH' && id) return db.contacts.update(id, data as Parameters<typeof db.contacts.update>[1]);
    if (method === 'DELETE' && id) { db.contacts.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled contacts: ${method}` } } };
  },

  reading: (method, id, _s, data, db) => {
    if (method === 'GET') return db.readingItems.getAll();
    if (method === 'POST') return db.readingItems.create(data as Parameters<typeof db.readingItems.create>[0]);
    if (method === 'PATCH' && id) return db.readingItems.update(id, data as Parameters<typeof db.readingItems.update>[1]);
    if (method === 'DELETE' && id) { db.readingItems.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled reading: ${method}` } } };
  },

  health: async (method, id, segments, data, db, query) => {
    if (method === 'GET' && !id) return db.healthRecords.getAll(query?.type);
    if (method === 'GET' && segments[1] === 'summary') return { summary: await db.healthRecords.getSummary(query?.days ? parseInt(query.days) : 7) };
    if (method === 'POST') return db.healthRecords.create(data as Parameters<typeof db.healthRecords.create>[0]);
    if (method === 'PATCH' && id) return db.healthRecords.update(id, data as Parameters<typeof db.healthRecords.update>[1]);
    if (method === 'DELETE' && id) { db.healthRecords.delete(id); return { success: true }; }
    throw { response: { data: { error: `Unhandled health: ${method}` } } };
  },

  workflows: (method, id, segments, data, db) => {
    if (method === 'GET' && !id) return db.workflows.getAll();
    if (method === 'POST' && !id) return db.workflows.create(data as Parameters<typeof db.workflows.create>[0]);
    if (method === 'GET' && id) return db.workflows.getOne(id);
    if (method === 'PATCH' && id && !segments[2]) return db.workflows.update(id, data as Parameters<typeof db.workflows.update>[1]);
    if (method === 'DELETE' && id && !segments[2]) { db.workflows.delete(id); return { success: true }; }
    if (method === 'POST' && id && segments[2] === 'steps') return db.workflows.addStep(id, data as Parameters<typeof db.workflows.addStep>[1]);
    if (method === 'PATCH' && id && segments[2] === 'steps' && segments[3]) return db.workflows.updateStep(segments[3], data as Parameters<typeof db.workflows.updateStep>[1]);
    if (method === 'DELETE' && id && segments[2] === 'steps' && segments[3]) { db.workflows.deleteStep(segments[3]); return { success: true }; }
    if (method === 'POST' && id && segments[2] === 'connections') return db.workflows.addConnection(id, data as Parameters<typeof db.workflows.addConnection>[1]);
    if (method === 'DELETE' && id && segments[2] === 'connections' && segments[3]) { db.workflows.deleteConnection(segments[3]); return { success: true }; }
    throw { response: { data: { error: `Unhandled workflows: ${method}` } } };
  },
};

export default dataMode === 'remote' ? remoteApi : dataMode === 'local' ? localDBAdapter : supabaseAdapter;
export { localDB, dataMode as useLocalMode };
