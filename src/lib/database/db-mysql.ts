import mysql from 'mysql2/promise';
import type { DbClient } from './db-types';
import { isBenignMigrationError } from './migration-errors';

export type MysqlPool = mysql.Pool;

export function createMysqlPool(): mysql.Pool {
  const host = process.env.MYSQL_HOST?.trim() || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER?.trim();
  const password = process.env.MYSQL_PASSWORD ?? '';
  const database = process.env.MYSQL_DATABASE?.trim();
  if (!user || !database) {
    throw new Error('MySQL 需配置 MYSQL_USER、MYSQL_DATABASE（可选 MYSQL_HOST/MYSQL_PASSWORD/MYSQL_PORT）');
  }
  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
    timezone: 'Z',
  });
}

export class MysqlDbClient implements DbClient {
  constructor(private readonly pool: mysql.Pool) {}

  async query<T = any>(sql: string, args: any[] = []): Promise<T[]> {
    try {
      const [rows] = await this.pool.execute(sql, args);
      return rows as T[];
    } catch (error) {
      console.error('[DB mysql] Query failed:', { sql, args, error });
      throw error;
    }
  }

  async queryOne<T = any>(sql: string, args: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, args);
    return rows[0] ?? null;
  }

  async execute(sql: string, args: any[] = []): Promise<{ changes: number }> {
    try {
      const [res] = await this.pool.execute(sql, args);
      const header = res as mysql.ResultSetHeader;
      return { changes: header.affectedRows ?? 0 };
    } catch (error) {
      if (!isBenignMigrationError(error)) {
        console.error('[DB mysql] Execute failed:', { sql, args, error });
      }
      throw error;
    }
  }

  getPool(): mysql.Pool {
    return this.pool;
  }
}
