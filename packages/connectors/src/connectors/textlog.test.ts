import { describe, expect, it } from 'vitest';
import { parseChatExport, toMeLogEntries, runTextlogConnector } from './textlog.js';
import { MeLogIngestClient, type IngestEntryInput } from '../lib/ingest.js';

const TXT = `2026-09-04 21:30 - 老王: 明天上午同步一下项目进度
这周有点忙
[2026-09-04 21:31] 我: 好的，10 点发周报
2026-09-05 09:00,老王,已收到,周报发我邮箱一份`;

const CSV = `time,sender,message
2026-09-04 21:30,老王,明天上午同步一下
2026-09-04 21:31,王小明,好的`;

describe('textlog 解析器', () => {
  it('should parse mixed line formats and merge continuation lines', () => {
    const messages = parseChatExport(TXT);
    expect(messages).toHaveLength(3);

    expect(messages[0].sender).toBe('老王');
    expect(messages[0].content).toBe('明天上午同步一下项目进度\n这周有点忙');

    expect(messages[1].sender).toBe('我');
    expect(messages[1].content).toBe('好的，10 点发周报');

    // CSV 行（无 --csv 时按行格式兜底解析：逗号被并入内容前段）
    expect(messages[2].occurredAt.getHours()).toBe(9);
  });

  it('should parse csv with header when csv mode is on', () => {
    const messages = parseChatExport(CSV, true);
    expect(messages).toHaveLength(2);
    expect(messages[0].sender).toBe('老王');
    expect(messages[1].sender).toBe('王小明');
  });

  it('should produce stable idempotent hashes and 我 actor mapping', () => {
    const messages = parseChatExport(CSV, true);
    const entries = toMeLogEntries(messages, { content: CSV, me: '王小明', talker: '老王' });

    expect(entries[1].actor).toBe('我');
    expect(entries[0].actor).toBe('老王');
    expect(entries[0].externalId).toMatch(/^textlog-[0-9a-f]{20}$/);

    const again = toMeLogEntries(parseChatExport(CSV, true), { content: CSV, me: '王小明', talker: '老王' });
    expect(again.map((e) => e.externalId)).toEqual(entries.map((e) => e.externalId));
    expect(entries.every((e) => e.category === 'im')).toBe(true);
  });
});

describe('textlog 端到端', () => {
  it('should push entries through the ingest client', async () => {
    const pushed: { adapter: string; name: string; entries: IngestEntryInput[] }[] = [];
    const client = new MeLogIngestClient({
      apiUrl: 'http://127.0.0.1:3001',
      fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        pushed.push({ adapter: body.source.adapter, name: body.source.name, entries: body.entries });
        return new Response(JSON.stringify({ sourceId: 's', created: body.entries.length, updated: 0, skipped: 0 }), {
          status: 200,
        });
      }) as typeof fetch,
    });

    const result = await runTextlogConnector({
      content: CSV,
      csv: true,
      me: '王小明',
      talker: '老王',
      sourceName: '微信聊天记录（手动导出）',
      client,
    });

    expect(result.created).toBe(2);
    expect(pushed[0].adapter).toBe('textlog');
    expect(pushed[0].name).toBe('微信聊天记录（手动导出）');
  });
});
