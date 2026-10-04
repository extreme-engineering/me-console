import { useSyncExternalStore } from 'react';
import okrRaw from '../../../../docs/目标/2026-10-OPC-OKR.md?raw';

/**
 * OKR & SOP 文档（docs/目标/2026-10-OPC-OKR.md）的读写层。
 * 文件内容以 vite dev 中间件写回仓库文件（见 vite.config.ts okrDocSavePlugin），
 * 生产构建下文件是 `?raw` 内联常量，只读。
 */

export const canSave = import.meta.env.DEV;

const OKR_DOC_URL = '/__okr-doc/2026-10-OPC-OKR.md';
const SAVE_TIMEOUT_MS = 8000;

const TASK_LINE_RE = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)([ xX])(\])/;

/**
 * 把 markdown 第 line 行（1-based）的 GFM 任务勾选状态翻转，返回新内容。
 * 行号越界或该行不是 `- [ ]` / `- [x]` 形式时返回 null。
 */
export function toggleTaskAtLine(md: string, line: number): string | null {
  if (!Number.isInteger(line) || line < 1) return null;
  const lines = md.split('\n');
  if (line > lines.length) return null;
  const index = line - 1;
  const match = lines[index].match(TASK_LINE_RE);
  if (!match) return null;
  const next = match[2] === ' ' ? 'x' : ' ';
  lines[index] = lines[index].replace(TASK_LINE_RE, `$1${next}$3`);
  return lines.join('\n');
}

// ---- 内容 store：优先当前编辑态，未编辑过则回落到构建期内联的源文件 ----

let current: string | null = null;
const listeners = new Set<() => void>();

export function getOkrMd(): string {
  return current ?? okrRaw;
}

export function setOkrMd(md: string): void {
  current = md;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOkrMd(): string {
  return useSyncExternalStore(subscribe, getOkrMd);
}

// ---- 保存：串行化，避免快速连点勾选时请求乱序覆盖 ----

let saveChain: Promise<void> = Promise.resolve();

async function postOkrDoc(md: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
  try {
    const res = await fetch(OKR_DOC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: md,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`保存失败（HTTP ${res.status}）`);
  } finally {
    clearTimeout(timer);
  }
}

export function saveOkrDoc(md: string): Promise<void> {
  const task = saveChain.then(() => postOkrDoc(md));
  saveChain = task.catch(() => undefined);
  return task;
}