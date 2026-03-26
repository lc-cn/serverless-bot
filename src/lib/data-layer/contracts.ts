import type { DatabaseEngine } from '@/lib/database/db';
import type { DbClient } from '@/lib/database/db-types';
import type { SqlDialect } from '@/lib/database/sql-dialect';
import type { KvBackendKind, KvRedisLike } from '@/lib/kv/kv-runtime';

export type { DbClient, KvRedisLike, KvBackendKind, DatabaseEngine };

/**
 * 基础设施层统一出口：主库 SQL + 侧车 KV（聊天、事件日志、Flow 队列等）。
 * 领域持久化请用 `storage` / `data.ts`；其底层仍通过 `getSql()` 访问同一 `db` 实例。
 */
export interface DataLayer {
  sql: DbClient;
  kv: KvRedisLike;
  dialect: SqlDialect;
  databaseEngine: DatabaseEngine;
  kvBackend: KvBackendKind;
}
