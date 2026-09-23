import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/**
 * MeLog 条目搜索：FTS5（trigram）+ LIKE 混合。
 *
 * - trigram 分词支持 CJK 子串检索，但需要 ≥3 个字符；
 *   因此 ≥3 字的关键词走 FTS 索引，短关键词回退 LIKE 全表过滤。
 * - 索引是自存储 FTS 表（非 external content），由触发器同步，
 *   通过事务 + 门禁标记保证并发进程下的自举安全。
 * - FTS 不可用（如 SQLite 编译裁剪）时自动退回 LIKE，功能不缺失。
 */

let readyPromise: Promise<boolean> | null = null;

export async function ensureEntryFts(): Promise<boolean> {
  if (!readyPromise) {
    readyPromise = bootstrapFts();
  }
  return readyPromise;
}

async function bootstrapFts(): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `CREATE VIRTUAL TABLE IF NOT EXISTS melog_entries_fts USING fts5(title, content, actor, tokenize='trigram')`,
      );
      await tx.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS melog_fts_meta (key TEXT PRIMARY KEY, value TEXT)`,
      );
      await tx.$executeRawUnsafe(
        `CREATE TRIGGER IF NOT EXISTS melog_entries_fts_ai AFTER INSERT ON "MeLogEntry" BEGIN
           INSERT INTO melog_entries_fts(rowid, title, content, actor) VALUES (new.rowid, new.title, new.content, new.actor);
         END`,
      );
      await tx.$executeRawUnsafe(
        `CREATE TRIGGER IF NOT EXISTS melog_entries_fts_ad AFTER DELETE ON "MeLogEntry" BEGIN
           DELETE FROM melog_entries_fts WHERE rowid = old.rowid;
         END`,
      );
      await tx.$executeRawUnsafe(
        `CREATE TRIGGER IF NOT EXISTS melog_entries_fts_au AFTER UPDATE ON "MeLogEntry" BEGIN
           DELETE FROM melog_entries_fts WHERE rowid = old.rowid;
           INSERT INTO melog_entries_fts(rowid, title, content, actor) VALUES (new.rowid, new.title, new.content, new.actor);
         END`,
      );
      // 门禁：INSERT OR IGNORE 只有一个进程能成功，回填与门禁同事务原子生效
      const gate = await tx.$executeRawUnsafe(
        `INSERT OR IGNORE INTO melog_fts_meta(key, value) VALUES ('backfill', 'done')`,
      );
      if (gate > 0) {
        const entryCount = await tx.meLogEntry.count();
        if (entryCount > 0) {
          await tx.$executeRawUnsafe(
            `INSERT INTO melog_entries_fts(rowid, title, content, actor) SELECT rowid, title, content, actor FROM "MeLogEntry"`,
          );
        }
      }
    });
    return true;
  } catch {
    return false;
  }
}

/** 供 WHERE 复用的搜索条件；q 为空返回 null（不加条件） */
export async function searchFilter(userId: string, q: string | undefined): Promise<Prisma.MeLogEntryWhereInput | null> {
  const keyword = (q || '').trim();
  if (!keyword) return null;

  const terms = keyword.split(/\s+/).filter(Boolean);
  const longTerms = terms.filter((t) => [...t].length >= 3);
  const shortTerms = terms.filter((t) => [...t].length < 3);

  const likeFor = (term: string): Prisma.MeLogEntryWhereInput => ({
    OR: [{ title: { contains: term } }, { content: { contains: term } }, { actor: { contains: term } }],
  });

  const andParts: Prisma.MeLogEntryWhereInput[] = [];

  if (longTerms.length > 0 && (await ensureEntryFts())) {
    try {
      const match = longTerms.map((t) => `"${t.replace(/"/g, '""')}"`).join(' ');
      const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `SELECT e.id FROM "MeLogEntry" e JOIN melog_entries_fts f ON f.rowid = e.rowid
         WHERE melog_entries_fts MATCH ? AND e.userId = ? LIMIT 500`,
        match,
        userId,
      );
      andParts.push({ id: { in: rows.map((row) => row.id) } });
    } catch {
      andParts.push(...longTerms.map(likeFor));
    }
  } else {
    andParts.push(...longTerms.map(likeFor));
  }
  andParts.push(...shortTerms.map(likeFor));

  if (andParts.length === 0) return likeFor(keyword);
  return { AND: andParts };
}
