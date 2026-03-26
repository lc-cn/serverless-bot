import {
  getDatabaseEngine,
  getKvBackendKind,
  isRelationalDatabaseConfigured,
} from '@/lib/data-layer';

/**
 * 对外访问的根 URL（末尾无斜杠）。用于配置 Webhook、OAuth 回调说明等。
 * 未配置环境变量时返回空字符串，由调用方使用相对路径或自行提示。
 */
export function getPublicAppUrl(): string {
  const u = process.env.NEXTAUTH_URL?.trim();
  if (u) return u.replace(/\/$/, '');
  return '';
}

/** 主库是否已按当前环境变量配置（见 `@/lib/data-layer` → `database/db.ts`） */
export function hasSqlDatabase(): boolean {
  return isRelationalDatabaseConfigured();
}

/** 供健康检查或调试：数据层形态摘要 */
export function getRuntimeSummary(): {
  kv: ReturnType<typeof getKvBackendKind>;
  sql: boolean;
  databaseEngine: ReturnType<typeof getDatabaseEngine>;
  publicUrl: string;
} {
  return {
    kv: getKvBackendKind(),
    sql: hasSqlDatabase(),
    databaseEngine: getDatabaseEngine(),
    publicUrl: getPublicAppUrl(),
  };
}
