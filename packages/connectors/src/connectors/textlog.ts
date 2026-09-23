import { createHash } from 'node:crypto';
import type { IngestEntryInput, IngestSummary, MeLogEntryCategory } from '../lib/ingest.js';
import type { MeLogIngestClient } from '../lib/ingest.js';

/**
 * textlog — 通用聊天记录文本导入（合规路径）。
 *
 * 面向「用户自己导出的聊天记录文件」（txt / csv），不接触任何应用的数据库，
 * 不做任何解密：数据来源与合法性由文件的主人（用户自己）保证。
 * 兼容三类常见行格式（可混排），无时间戳的行并入上一条消息：
 *
 *   [2026-09-04 21:30] 老王: 明天同步一下
 *   2026-09-04 21:30 - 老王: 明天同步一下
 *   2026-09-04 21:30,老王,明天同步一下        （csv：时间,发送者,内容）
 *
 * externalId 为内容哈希，重复导入自动幂等更新。
 */

export interface ParsedChatMessage {
  occurredAt: Date;
  sender: string;
  content: string;
  /** 稳定哈希，用于幂等 externalId */
  hash: string;
}

export interface TextlogOptions {
  /** 已读取的文件内容 */
  content: string;
  /** 会话显示名（标题用），默认取文件名 */
  talker?: string;
  /** 用户自己在导出文件里的名字；匹配到的发送者记为「我」 */
  me?: string;
  sourceName?: string;
  /** 按 CSV（时间,发送者,内容）解析；缺省按行格式自动解析 */
  csv?: boolean;
}

const LINE_RE =
  /^\[?(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)\]?\s*[-–—]?\s*([^:：,，]{1,50})[:：]\s?(.*)$/;
const CSV_TIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;
const MAX_CONTENT = 5000;

function hashOf(sender: string, rawTime: string, content: string): string {
  return createHash('sha256').update(`${sender}|${rawTime}|${content}`).digest('hex').slice(0, 20);
}

function toDate(day: string, time: string): Date | null {
  const full = time.length === 5 ? `${time}:00` : time;
  const date = new Date(`${day}T${full}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseChatExport(content: string, csv = false): ParsedChatMessage[] {
  const messages: ParsedChatMessage[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let day: string | undefined;
    let time: string | undefined;
    let sender = '';
    let text = '';

    // 行格式不匹配时的 CSV 兜底（时间,发送者,内容…）
    const tryCsvLine = (): boolean => {
      const parts = line.split(',');
      if (parts.length >= 3 && CSV_TIME_RE.test(parts[0].trim())) {
        const full = parts[0].trim();
        day = full.slice(0, 10);
        time = full.slice(11).trim() || '00:00';
        sender = parts[1].trim();
        text = parts.slice(2).join(',').trim();
        return true;
      }
      return false;
    };

    if (csv) {
      if (!tryCsvLine()) continue; // 表头行（time,sender,message）或其他非数据行：忽略
    } else {
      const match = line.match(LINE_RE);
      if (match) {
        [, day, time, sender, text] = match;
        sender = sender.trim();
        text = text.trim();
      } else if (!tryCsvLine()) {
        // 无时间戳的行：并入上一条消息（多行消息）
        if (messages.length > 0) {
          const last = messages[messages.length - 1];
          last.content = `${last.content}\n${line}`.slice(0, MAX_CONTENT);
        }
        continue;
      }
    }

    if (!day || !time) continue;
    const occurredAt = toDate(day, time);
    if (!occurredAt || !sender) continue;
    messages.push({
      occurredAt,
      sender,
      content: text.slice(0, MAX_CONTENT),
      hash: hashOf(sender, `${day} ${time}`, text),
    });
  }

  return messages;
}

export function toMeLogEntries(
  messages: ParsedChatMessage[],
  options: TextlogOptions,
): IngestEntryInput[] {
  const talker = options.talker?.trim() || options.sourceName?.trim() || '聊天记录';
  return messages.map((message) => ({
    externalId: `textlog-${message.hash}`,
    category: 'im' as MeLogEntryCategory,
    type: 'chat-message',
    title: `与 ${talker} 的对话`,
    content: message.content,
    actor: options.me && message.sender === options.me ? '我' : message.sender,
    tags: 'textlog',
    occurredAt: message.occurredAt.toISOString(),
  }));
}

export async function runTextlogConnector(
  options: TextlogOptions & { client: MeLogIngestClient },
): Promise<IngestSummary & { messages: number }> {
  const messages = parseChatExport(options.content, options.csv ?? false);
  const entries = toMeLogEntries(messages, options);
  const result = await options.client.ingest(
    'textlog',
    options.sourceName || options.talker || '聊天记录导入',
    'im',
    entries,
  );
  return { ...result, messages: messages.length };
}
