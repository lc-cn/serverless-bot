import type { DbClient } from './db-types';

function rowHasOwnerIdSqlite(rows: Array<{ name?: string }>): boolean {
  return rows.some((r) => String(r.name) === 'owner_id');
}

/**
 * node:sqlite / DatabaseSync 同步补列（避免在 DbClient.query 内递归初始化）。
 */
export function ensureOwnerColumnsSqliteSync(db: {
  prepare: (sql: string) => { all: (...args: any[]) => any; run: (...args: any[]) => any };
}): void {
  const tables = ['bots', 'flows', 'jobs', 'triggers'] as const;
  for (const table of tables) {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (rows.length === 0) continue;
    if (rowHasOwnerIdSqlite(rows)) continue;
    try {
      db.prepare(
        `ALTER TABLE ${table} ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL`
      ).run();
      console.info(`[DB] Added column ${table}.owner_id`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (!m.includes('duplicate') && !m.includes('Duplicate')) throw e;
    }
  }
  for (const sql of [
    'CREATE INDEX IF NOT EXISTS idx_bots_owner_id ON bots(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_flows_owner ON flows(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_triggers_owner ON triggers(owner_id)',
  ]) {
    try {
      db.prepare(sql).run();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m.includes('already exists') || m.includes('duplicate')) continue;
      if (m.includes('no such table')) continue;
      throw e;
    }
  }
}

/** libSQL（远程或同一进程的异步客户端）在首次连接后调用。 */
export async function ensureOwnerColumnsLibsql(db: DbClient): Promise<void> {
  const tables = ['bots', 'flows', 'jobs', 'triggers'] as const;
  for (const table of tables) {
    const rows = await db.query<{ name: string }>(`PRAGMA table_info(${table})`, []);
    if (rows.length === 0) continue;
    if (rowHasOwnerIdSqlite(rows)) continue;
    try {
      await db.execute(
        `ALTER TABLE ${table} ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL`,
        []
      );
      console.info(`[DB] Added column ${table}.owner_id`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (!m.includes('duplicate') && !m.includes('Duplicate')) throw e;
    }
  }
  for (const sql of [
    'CREATE INDEX IF NOT EXISTS idx_bots_owner_id ON bots(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_flows_owner ON flows(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(owner_id)',
    'CREATE INDEX IF NOT EXISTS idx_triggers_owner ON triggers(owner_id)',
  ]) {
    try {
      await db.execute(sql, []);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (m.includes('already exists') || m.includes('duplicate')) continue;
      if (m.includes('no such table')) continue;
      throw e;
    }
  }
}
