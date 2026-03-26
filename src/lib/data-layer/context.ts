import { db, getDatabaseEngine } from '@/lib/database/db';
import type { DbClient } from '@/lib/database/db-types';
import { getSqlDialect } from '@/lib/database/sql-dialect';
import { getKvBackendKind, getKvRedis } from '@/lib/kv/kv-runtime';
import type { KvRedisLike } from '@/lib/kv/kv-runtime';
import type { DataLayer } from './contracts';

let _layer: DataLayer | null = null;

/**
 * 懒构建一次：保证 `sql` / `kv` 与全局单例 `db`、`getKvRedis()` 一致。
 */
export function getDataLayer(): DataLayer {
  if (!_layer) {
    _layer = {
      sql: db,
      kv: getKvRedis(),
      dialect: getSqlDialect(),
      databaseEngine: getDatabaseEngine(),
      kvBackend: getKvBackendKind(),
    };
  }
  return _layer;
}

/** 主库客户端（与 `getDataLayer().sql` 相同引用） */
export function getSql(): DbClient {
  return db;
}

/** KV 客户端（与 `getDataLayer().kv` 相同引用） */
export function getKv(): KvRedisLike {
  return getDataLayer().kv;
}
