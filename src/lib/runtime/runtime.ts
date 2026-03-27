import {
  db,
  getDatabaseEngine,
  getKvBackendKind,
  isRelationalDatabaseConfigured,
} from '@/lib/data-layer';
import { getLatestAppliedMigration } from '@/lib/database/sql-migrate';
import { getSqlDialect } from '@/lib/database/sql-dialect';
import { getInstallPhase } from '@/lib/install/install-state';
import type { InstallPhase } from '@/types';

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

/** `process.memoryUsage()` 快照；Edge 等无 API 时为 null */
export type ProcessMemorySnapshot = {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers?: number;
};

function captureProcessMemorySnapshot(): ProcessMemorySnapshot | null {
  if (typeof process.memoryUsage !== 'function') return null;
  const m = process.memoryUsage();
  const snap: ProcessMemorySnapshot = {
    heapUsed: m.heapUsed,
    heapTotal: m.heapTotal,
    rss: m.rss,
    external: m.external,
  };
  if (typeof m.arrayBuffers === 'number' && Number.isFinite(m.arrayBuffers)) {
    snap.arrayBuffers = m.arrayBuffers;
  }
  return snap;
}

/** 控制台「服务器概况」：无密钥，仅形态与环境摘要 */
export type DashboardServerOverview = ReturnType<typeof getRuntimeSummary> & {
  nodeVersion: string;
  nodeEnv: string;
  installPhase: InstallPhase;
  lastAppliedMigration: string | null;
  sqlDialect: 'sqlite' | 'mysql' | null;
  /** 当前 Node 进程内存（本页 SSR 请求瞬间值） */
  processMemory: ProcessMemorySnapshot | null;
};

export async function getDashboardServerOverview(): Promise<DashboardServerOverview> {
  const base = getRuntimeSummary();
  let lastAppliedMigration: string | null = null;
  if (base.sql) {
    try {
      lastAppliedMigration = await getLatestAppliedMigration(db);
    } catch {
      lastAppliedMigration = null;
    }
  }
  const installPhase = await getInstallPhase();
  return {
    ...base,
    nodeVersion: process.version,
    nodeEnv: process.env.NODE_ENV || 'development',
    installPhase,
    lastAppliedMigration,
    sqlDialect: base.sql ? getSqlDialect() : null,
    processMemory: captureProcessMemorySnapshot(),
  };
}
