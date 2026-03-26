import { createClient, type Client } from '@libsql/client';
import { MysqlDbClient, createMysqlPool } from './db-mysql';
import { NodeSqliteDbClient, resolveNodeSqlitePath } from './db-node-sqlite';
import type { DbClient } from './db-types';
import { ensureOwnerColumnsLibsql } from './ensure-owner-schema';
import { isBenignMigrationError } from './migration-errors';
import { setSqlDialect } from './sql-dialect';

export type { DbClient } from './db-types';

export type DatabaseEngine = 'libsql' | 'nodejs-sqlite' | 'mysql';

function inferEngine(): DatabaseEngine {
  const explicit = process.env.DATABASE_ENGINE?.trim().toLowerCase();
  if (explicit === 'mysql' || explicit === 'nodejs-sqlite' || explicit === 'libsql') {
    return explicit;
  }
  const hasSqlitePath = Boolean(process.env.SQLITE_PATH?.trim());
  const hasLibsql = Boolean(process.env.LIBSQL_URL?.trim());
  if (hasSqlitePath && !hasLibsql) return 'nodejs-sqlite';
  return 'libsql';
}

/** 当前进程解析到的主库引擎（与 `db` 实例一致） */
export function getDatabaseEngine(): DatabaseEngine {
  return inferEngine();
}

function isFileSqlUrl(url: string): boolean {
  return /^file:/i.test(url.trim());
}

export function resolvePrimarySqlConfig(): {
  url: string;
  authToken: string | undefined;
  isFile: boolean;
} | null {
  const url = process.env.LIBSQL_URL?.trim();
  if (!url) return null;
  const token = process.env.LIBSQL_AUTH_TOKEN?.trim();
  const isFile = isFileSqlUrl(url);
  if (!isFile && !token) {
    console.warn('[DB] 远端 libSQL 需配置 LIBSQL_AUTH_TOKEN；当前无 token，跳过连接。');
    return null;
  }
  return { url, authToken: isFile ? token || undefined : token, isFile };
}

export function isRelationalDatabaseConfigured(): boolean {
  const engine = inferEngine();
  if (engine === 'mysql') {
    return Boolean(process.env.MYSQL_USER?.trim() && process.env.MYSQL_DATABASE?.trim());
  }
  if (engine === 'nodejs-sqlite') {
    return Boolean(resolveNodeSqlitePath());
  }
  return resolvePrimarySqlConfig() != null;
}

class LibsqlDbClient implements DbClient {
  private client: Client | null = null;

  private async getClient(): Promise<Client | null> {
    if (this.client) return this.client;

    const cfg = resolvePrimarySqlConfig();
    if (!cfg) {
      console.warn('[DB] 未配置 LIBSQL_URL — libsql 主库未连接；读操作多返回空、写操作不落库。');
      return null;
    }

    try {
      const c = cfg.isFile
        ? createClient({ url: cfg.url, authToken: cfg.authToken })
        : createClient({ url: cfg.url, authToken: cfg.authToken! });
      this.client = c;
      await ensureOwnerColumnsLibsql(this);
      return this.client;
    } catch (error) {
      console.error('[DB] Failed to create libSQL client or owner schema:', error);
      this.client = null;
      return null;
    }
  }

  async query<T = any>(sql: string, args: any[] = []): Promise<T[]> {
    const client = await this.getClient();
    if (!client) return [];

    try {
      const result = await client.execute({
        sql,
        args: args as any,
      });
      return (result.rows || []) as T[];
    } catch (error) {
      console.error('[DB] Query failed:', { sql, args, error });
      throw error;
    }
  }

  async queryOne<T = any>(sql: string, args: any[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, args);
    return results[0] || null;
  }

  async execute(sql: string, args: any[] = []): Promise<{ changes: number }> {
    const client = await this.getClient();
    if (!client) return { changes: 0 };

    try {
      const result = await client.execute({
        sql,
        args: args as any,
      });
      return { changes: (result as any).changes || (result.rows?.length ?? 0) || 0 };
    } catch (error) {
      if (!isBenignMigrationError(error)) {
        console.error('[DB] Execute failed:', { sql, args, error });
      }
      throw error;
    }
  }
}

function createDbClient(): DbClient {
  const engine = inferEngine();

  if (engine === 'mysql') {
    setSqlDialect('mysql');
    return new MysqlDbClient(createMysqlPool());
  }

  if (engine === 'nodejs-sqlite') {
    setSqlDialect('sqlite');
    const path = resolveNodeSqlitePath();
    if (!path) {
      throw new Error(
        'DATABASE_ENGINE=nodejs-sqlite 或仅配置了 SQLITE_PATH 但未设置有效路径。请设置 SQLITE_PATH（如 file:./data.db）'
      );
    }
    return new NodeSqliteDbClient(path);
  }

  setSqlDialect('sqlite');
  return new LibsqlDbClient();
}

declare global {
  var dbClient: DbClient | undefined;
}

export const db: DbClient = globalThis.dbClient ?? (globalThis.dbClient = createDbClient());
