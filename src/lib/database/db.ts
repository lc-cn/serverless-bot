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
  const hasLibsql = Boolean(
    process.env.LIBSQL_URL?.trim() || process.env.TURSO_DATABASE_URL?.trim(),
  );
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

/**
 * 合并 Vercel Turso 默认名 `TURSO_*` 与通用 `LIBSQL_*`。
 * 优先级：与 Vercel 集成一致，`TURSO_DATABASE_URL` > `LIBSQL_URL`；Token 两组互为后备。
 */
function pickLibsqlFromEnv(): {
  url: string;
  authToken: string | undefined;
  isFile: boolean;
  binding: 'libsql' | 'turso';
} | null {
  const libsqlUrl = process.env.LIBSQL_URL?.trim();
  const libsqlToken = process.env.LIBSQL_AUTH_TOKEN?.trim();
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl) {
    const isFile = isFileSqlUrl(tursoUrl);
    const authToken = tursoToken || libsqlToken || undefined;
    if (!isFile && !authToken) {
      console.warn(
        '[DB] 已设置 TURSO_DATABASE_URL 但未找到 TURSO_AUTH_TOKEN 或 LIBSQL_AUTH_TOKEN，跳过连接。',
      );
      return null;
    }
    return { url: tursoUrl, authToken, isFile, binding: 'turso' };
  }

  if (libsqlUrl) {
    const isFile = isFileSqlUrl(libsqlUrl);
    const authToken = libsqlToken || tursoToken || undefined;
    if (!isFile && !authToken) {
      console.warn(
        '[DB] 已设置 LIBSQL_URL（远端）但未找到 LIBSQL_AUTH_TOKEN 或 TURSO_AUTH_TOKEN，跳过连接。',
      );
      return null;
    }
    return { url: libsqlUrl, authToken, isFile, binding: 'libsql' };
  }

  return null;
}

export function resolvePrimarySqlConfig(): {
  url: string;
  authToken: string | undefined;
  isFile: boolean;
} | null {
  const picked = pickLibsqlFromEnv();
  if (!picked) return null;
  const { url, authToken, isFile } = picked;
  return { url, authToken, isFile };
}

/** 供安装页判断数据库 URL 是否已由部署平台注入（不返回密钥）。 */
export function getLibsqlEnvSnapshot(): {
  binding: 'libsql' | 'turso' | null;
  tokenPresent: boolean;
  canConnect: boolean;
} {
  const binding = process.env.TURSO_DATABASE_URL?.trim()
    ? ('turso' as const)
    : process.env.LIBSQL_URL?.trim()
      ? ('libsql' as const)
      : null;
  const tokenPresent = Boolean(libsqlTokenOrTursoToken());
  return {
    binding,
    tokenPresent,
    canConnect: resolvePrimarySqlConfig() != null,
  };
}

function libsqlTokenOrTursoToken(): string | undefined {
  return process.env.TURSO_AUTH_TOKEN?.trim() || process.env.LIBSQL_AUTH_TOKEN?.trim();
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
      console.warn(
        '[DB] 未配置可用 libSQL 连接（请设置 TURSO_DATABASE_URL 或 LIBSQL_URL，远端须带对应 Token）— 主库未连接。',
      );
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
