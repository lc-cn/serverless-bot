import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { DbClient } from './db-types';
import { isBenignMigrationError } from './migration-errors';
import { getSqlDialect } from './sql-dialect';

/**
 * 拆分迁移文件中的语句（忽略行尾 -- 注释；单引号内分号不拆分）。
 */
export function splitSqlStatements(raw: string): string[] {
  let sql = raw.replace(/\r\n/g, '\n');
  sql = sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      if (idx === -1) return line;
      return line.slice(0, idx);
    })
    .join('\n');

  const out: string[] = [];
  let cur = '';
  let i = 0;
  let inSingle = false;
  while (i < sql.length) {
    const c = sql[i];
    if (inSingle) {
      cur += c;
      if (c === "'") {
        if (sql[i + 1] === "'") {
          cur += sql[i + 1];
          i += 2;
          continue;
        }
        inSingle = false;
      }
      i++;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      cur += c;
      i++;
      continue;
    }
    if (c === ';') {
      const t = cur.trim();
      if (t) out.push(t);
      cur = '';
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  const t = cur.trim();
  if (t) out.push(t);
  return out.filter((s) => s.length > 0);
}

async function ensureSchemaMigrationsTable(db: DbClient): Promise<void> {
  if (getSqlDialect() === 'mysql') {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at BIGINT NOT NULL,
        checksum VARCHAR(64) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      [],
    );
  } else {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL,
        checksum TEXT
      )`,
      [],
    );
  }
}

/** 当前主库已记录的最新迁移文件名（如 `001_initial.sql`），无表或空库时返回 null */
export async function getLatestAppliedMigration(db: DbClient): Promise<string | null> {
  try {
    await ensureSchemaMigrationsTable(db);
    const row = await db.queryOne<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1',
      [],
    );
    return row?.version ?? null;
  } catch {
    return null;
  }
}

/**
 * 按文件名顺序执行 `migrations/` 下除 `mysql/` 外的 *.sql。
 * 已写入 `schema_migrations` 的版本跳过；未记录版本整文件执行，遇非「良性」错误则中止后续文件。
 */
export async function runSqliteMigrationsFromDisk(
  db: DbClient,
  migrationsDir: string,
): Promise<{
  files: string[];
  statements: number;
  errors: string[];
  appliedThisRun: string[];
}> {
  await ensureSchemaMigrationsTable(db);

  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .filter((n) => !n.startsWith('.'))
    .sort((a, b) => a.localeCompare(b));

  const errors: string[] = [];
  let statements = 0;
  const appliedThisRun: string[] = [];

  for (const name of files) {
    const already = await db.queryOne<{ v: number }>(
      'SELECT 1 AS v FROM schema_migrations WHERE version = ? LIMIT 1',
      [name],
    );
    if (already) continue;

    const full = join(migrationsDir, name);
    const raw = await readFile(full, 'utf-8');
    const stmts = splitSqlStatements(raw);
    let fileFailed = false;

    for (const stmt of stmts) {
      statements += 1;
      try {
        await db.execute(stmt, []);
      } catch (e) {
        if (isBenignMigrationError(e)) continue;
        errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
        fileFailed = true;
        break;
      }
    }

    if (fileFailed) {
      break;
    }

    const now = Date.now();
    await db.execute('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [name, now]);
    appliedThisRun.push(name);
  }

  return { files, statements, errors, appliedThisRun };
}
