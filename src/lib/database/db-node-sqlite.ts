import { mkdirSync } from 'fs';
import { dirname, isAbsolute, resolve } from 'path';
import type { DbClient } from './db-types';
import { ensureOwnerColumnsSqliteSync } from './ensure-owner-schema';
import { isBenignMigrationError } from './migration-errors';

type DatabaseSyncCtor = typeof import('node:sqlite').DatabaseSync;

/**
 * Node.js 22.5+ / 24+ 自带的 `node:sqlite`（SQLite3），本地文件、与 SQLite 方言一致。
 * 环境：`DATABASE_ENGINE=nodejs-sqlite` 且设置 `SQLITE_PATH`（可为 `file:./x.db` 或绝对路径）。
 */
export class NodeSqliteDbClient implements DbClient {
  private db: InstanceType<DatabaseSyncCtor> | null = null;

  constructor(private readonly filePath: string) {}

  private async open(): Promise<InstanceType<DatabaseSyncCtor>> {
    if (this.db) return this.db;
    let DatabaseSync: DatabaseSyncCtor;
    try {
      ({ DatabaseSync } = await import('node:sqlite'));
    } catch (e) {
      throw new Error(
        '无法加载 node:sqlite。请使用 Node.js >= 22.5 并开启 SQLite 能力，或改用 DATABASE_ENGINE=libsql。',
        { cause: e }
      );
    }
    mkdirSync(dirname(this.filePath), { recursive: true });
    const instance = new DatabaseSync(this.filePath);
    ensureOwnerColumnsSqliteSync(instance);
    this.db = instance;
    return this.db;
  }

  async getRaw(): Promise<InstanceType<DatabaseSyncCtor>> {
    return this.open();
  }

  async query<T = any>(sql: string, args: any[] = []): Promise<T[]> {
    const database = await this.open();
    try {
      const stmt = database.prepare(sql);
      return stmt.all(...args) as T[];
    } catch (error) {
      console.error('[DB node-sqlite] Query failed:', { sql, args, error });
      throw error;
    }
  }

  async queryOne<T = any>(sql: string, args: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, args);
    return rows[0] ?? null;
  }

  async execute(sql: string, args: any[] = []): Promise<{ changes: number }> {
    const database = await this.open();
    try {
      const stmt = database.prepare(sql);
      const info = stmt.run(...args) as { changes: number };
      return { changes: Number(info.changes ?? 0) };
    } catch (error) {
      if (!isBenignMigrationError(error)) {
        console.error('[DB node-sqlite] Execute failed:', { sql, args, error });
      }
      throw error;
    }
  }
}

/** 相对路径按 `process.cwd()`（请在仓库根目录执行 `next dev`）解析，避免 Next 工作目录导致找不到文件。 */
export function resolveNodeSqlitePath(): string | null {
  const raw = process.env.SQLITE_PATH?.trim();
  if (!raw) return null;
  const withoutFilePrefix = raw.replace(/^file:/i, '').trim();
  if (!withoutFilePrefix) return null;
  return isAbsolute(withoutFilePrefix) ? withoutFilePrefix : resolve(process.cwd(), withoutFilePrefix);
}
