import { readdir } from 'fs/promises';
import { join } from 'path';
import type { InstallPhase } from '@/types';
import { db, isRelationalDatabaseConfigured } from '../data-layer';
import { initializeRBAC } from '@/lib/persistence/data';
import { getSqlDialect } from '../database/sql-dialect';
import { getLatestAppliedMigration, runSqliteMigrationsFromDisk } from '../database/sql-migrate';

/** 不查询 `roles` 本体，避免空库时 sqlite 报 no such table 并刷 error 日志 */
async function hasRolesTable(): Promise<boolean> {
  if (getSqlDialect() === 'mysql') {
    const row = await db.queryOne<{ n: number }>(
      `SELECT COUNT(*) as n FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'roles'`,
      [],
    );
    return Number((row as { n?: number })?.n ?? 0) > 0;
  }
  const row = await db.queryOne<{ n: number }>(
    `SELECT COUNT(*) as n FROM sqlite_master WHERE type = 'table' AND name = 'roles'`,
    [],
  );
  return Number((row as { n?: number })?.n ?? 0) > 0;
}

/**
 * 磁盘上 `migrations/*.sql`（含后续版本更新新增文件）是否尚未写入 `schema_migrations`。
 * MySQL 部署走独立 SQL，此处不判断。
 */
async function hasPendingDiskMigrations(): Promise<boolean> {
  if (getSqlDialect() === 'mysql') {
    return false;
  }
  try {
    const migrationsDir = join(process.cwd(), 'migrations');
    const entries = await readdir(migrationsDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith('.sql'))
      .map((e) => e.name)
      .filter((n) => !n.startsWith('.'))
      .sort((a, b) => a.localeCompare(b));
    if (files.length === 0) return false;
    const lastApplied = await getLatestAppliedMigration(db);
    if (!lastApplied) return true;
    const newest = files[files.length - 1];
    return newest.localeCompare(lastApplied) > 0;
  } catch {
    return false;
  }
}

/**
 * 安装状态：
 * - `no_database`：未配置主库
 * - `needs_install`：已连库但未完成首次建表 / RBAC（空库、缺表、无角色）
 * - `needs_upgrade`：业务已初始化，仅磁盘上尚有未应用的 `migrations/*.sql`
 * - `installed`：就绪
 */
export async function getInstallPhase(): Promise<InstallPhase> {
  if (!isRelationalDatabaseConfigured()) {
    return 'no_database';
  }
  try {
    if (!(await hasRolesTable())) {
      return 'needs_install';
    }
    const row = await db.queryOne<{ n: number }>('SELECT COUNT(*) as n FROM roles', []);
    const n = Number((row as { n?: number })?.n ?? 0);
    if (n === 0) {
      return 'needs_install';
    }
    if (await hasPendingDiskMigrations()) {
      return 'needs_upgrade';
    }
    return 'installed';
  } catch {
    return 'needs_install';
  }
}

export type BootstrapInstallResult = {
  ok: boolean;
  files: string[];
  statements: number;
  errors: string[];
  message: string;
  /** 主库 `schema_migrations` 中最新一条（迁移成功后） */
  lastAppliedMigration?: string | null;
  appliedThisRun?: string[];
};

/**
 * 执行磁盘迁移 + RBAC 初始化（与 SQLite / libSQL 方言一致）。
 */
export async function bootstrapDatabaseSchema(): Promise<BootstrapInstallResult> {
  const migrationsDir = join(process.cwd(), 'migrations');
  const { files, statements, errors, appliedThisRun } = await runSqliteMigrationsFromDisk(db, migrationsDir);
  if (errors.length > 0) {
    return {
      ok: false,
      files,
      statements,
      errors,
      message: '迁移未全部成功，请根据错误信息修复后重试',
      appliedThisRun,
      lastAppliedMigration: await getLatestAppliedMigration(db),
    };
  }
  try {
    await initializeRBAC();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      files,
      statements,
      errors: [msg],
      message: 'RBAC 初始化失败',
      appliedThisRun,
      lastAppliedMigration: await getLatestAppliedMigration(db),
    };
  }
  const lastAppliedMigration = await getLatestAppliedMigration(db);
  const newMsg =
    appliedThisRun.length > 0
      ? `新应用迁移: ${appliedThisRun.join(', ')}；库内最新版本: ${lastAppliedMigration ?? '—'}；并完成 RBAC 初始化`
      : `无需新迁移（已处于 ${lastAppliedMigration ?? '—'}）；并完成 RBAC 检查`;
  return {
    ok: true,
    files,
    statements,
    errors: [],
    message: newMsg,
    lastAppliedMigration,
    appliedThisRun,
  };
}
