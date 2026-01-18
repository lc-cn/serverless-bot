import { createClient, type Client } from '@libsql/client';

export interface DbClient {
  query<T = any>(sql: string, args?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, args?: any[]): Promise<T | null>;
  execute(sql: string, args?: any[]): Promise<{ changes: number }>;
}

class LibsqlDbClient implements DbClient {
  private client: Client | null = null;

  private async getClient(): Promise<Client | null> {
    if (this.client) return this.client;

    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url || !token) {
      console.warn('[DB] TURSO credentials not configured, using in-memory only');
      return null;
    }

    try {
      this.client = createClient({ url, authToken: token });
      return this.client;
    } catch (error) {
      console.error('[DB] Failed to create Turso client:', error);
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
      // libSQL 返回 rows 作为对象数组
      return (result.rows || []) as T[];
    } catch (error) {
      console.error('[DB] Query failed:', { sql, args, error });
      return [];
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
      // libSQL 返回 lastInsertRowid 和其他信息，对于 INSERT/UPDATE/DELETE 计算影响行数
      // ResultSet 通过 rows.length 反映受影响的行
      return { changes: (result as any).changes || (result.rows?.length ?? 0) || 0 };
    } catch (error) {
      console.error('[DB] Execute failed:', { sql, args, error });
      return { changes: 0 };
    }
  }
}

// 全局单例
declare global {
  var dbClient: DbClient | undefined;
}

function createDbClient(): DbClient {
  return new LibsqlDbClient();
}

export const db: DbClient = globalThis.dbClient ?? (globalThis.dbClient = createDbClient());
