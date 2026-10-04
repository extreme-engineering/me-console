/**
 * 品牌 API 客户端：连接器向品牌板块写入渠道快照的统一出口。
 *
 * 零运行时依赖（Node 18+ 全局 fetch）。当 MeOS 后端开启开发旁路
 * （MEOS_DEV_AUTH=true）时无需传 token；否则请设置 MEOS_TOKEN 环境变量。
 */

export interface PlatformChannelSummary {
  id: string;
  platform: string;
  name: string;
  handle?: string | null;
  status?: string;
}

export interface BrandSnapshotInput {
  channelId: string;
  followers: number;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  revenue?: number | null;
  note?: string | null;
}

export interface BrandApiClientOptions {
  /** MeOS API 根地址，如 http://localhost:3001 */
  apiUrl: string;
  /** Bearer Token；开发模式下可省略 */
  token?: string;
  fetchImpl?: typeof fetch;
}

export class BrandApiClient {
  private readonly base: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BrandApiClientOptions) {
    if (!/^https?:\/\//.test(options.apiUrl)) {
      throw new Error('apiUrl 仅支持 http/https 地址');
    }
    this.base = `${options.apiUrl.replace(/\/+$/, '')}/api/brand`;
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async listChannels(): Promise<PlatformChannelSummary[]> {
    const data = (await this.request('GET', '/channels')) as { channels?: PlatformChannelSummary[] };
    return data.channels || [];
  }

  async createChannel(input: {
    platform: string;
    name: string;
    handle?: string | null;
    positioning?: string | null;
  }): Promise<PlatformChannelSummary> {
    const data = (await this.request('POST', '/channels', input)) as { channel?: PlatformChannelSummary };
    if (!data.channel) throw new Error('创建渠道失败：响应缺少 channel');
    return data.channel;
  }

  async postSnapshot(input: BrandSnapshotInput): Promise<void> {
    await this.request('POST', '/snapshots', input);
  }

  /**
   * 品牌渠道解析：explicitChannelId 优先；否则从已有渠道按 platformPredicate 过滤，
   * 恰好一个返回，多个报错列出供用户挑，全部没有则 createChannels 自动创建。
   */
  async resolveOrCreateChannel(options: {
    explicitChannelId?: string;
    platformPredicate: (c: PlatformChannelSummary) => boolean;
    /** 报错时给用户的平台名标签（如 "wechat-mp"、"GitHub"） */
    label: string;
    create: { platform: string; name: string; handle: string | null; positioning?: string | null };
  }): Promise<string> {
    if (options.explicitChannelId) return options.explicitChannelId;
    const channels = await this.listChannels();
    const matched = channels.filter(options.platformPredicate);
    if (matched.length === 1) return matched[0].id;
    if (matched.length > 1) {
      const ids = matched.map((c) => `${c.name}(${c.id})`).join('、');
      throw new Error(`存在多个 ${options.label} 渠道：${ids}。请用 --channel-id 指定目标渠道`);
    }
    const created = await this.createChannel(options.create);
    return created.id;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 401) {
      throw new Error(
        'MeOS 返回 401：当前 API 未开启开发免鉴权时需要 --token（或环境变量 MEOS_API_TOKEN）',
      );
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`品牌 API 请求失败（HTTP ${response.status}）：${text.slice(0, 300)}`);
    }
    if (response.status === 204) return {};
    return response.json();
  }
}
