/**
 * 数据驱动层（组合根）
 *
 * - **SQL**：`database/` 内 libSQL / Node SQLite / MySQL 的具体实现；对外统一为 `DbClient`。
 * - **KV**：`kv/kv-runtime` 内 Redis REST（Upstash）或内存实现；对外统一为 `KvRedisLike`。
 *
 * 推荐：
 * - 需要同时感知引擎类型或一次性取齐依赖：`getDataLayer()`
 * - 仅 SQL：`getSql()` 或 `db`
 * - 仅 KV：`getKv()` 或 `getKvRedis()`
 */

export type { DataLayer, DbClient, KvRedisLike, KvBackendKind, DatabaseEngine } from './contracts';

export { getDataLayer, getSql, getKv } from './context';

export {
  db,
  getDatabaseEngine,
  getLibsqlEnvSnapshot,
  isRelationalDatabaseConfigured,
  resolvePrimarySqlConfig,
} from '@/lib/database/db';

export {
  getKvRedis,
  getKvBackendKind,
  resolveKvRestConfig,
} from '@/lib/kv/kv-runtime';
