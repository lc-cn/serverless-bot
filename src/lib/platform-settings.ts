import { z } from 'zod';
import { db } from '@/lib/data-layer';
import { getSqlDialect } from '@/lib/database/sql-dialect';

export const platformSettingsSchema = z.object({
  version: z.number(),
  flowProcessBudgetMs: z.number().int().min(0).max(86_400_000),
  flowStopAfterFirstMatch: z.boolean(),
  webhookMaxDurationSec: z.number().int().min(1).max(300),
  webhookFlowAsync: z.boolean(),
  webhookFlowDedupeOnSuccessOnly: z.boolean(),
  webhookFlowQueueMax: z.number().int().min(11).max(1_000_000),
  flowWorkerDlqMax: z.number().int().min(11).max(500_000),
  flowWorkerMaxAttempts: z.number().int().min(1).max(50),
  flowWorkerRetryDelayMs: z.number().int().min(0).max(3_600_000),
  webhookFlowDedupeTtlSec: z.number().int().min(61).max(86_400 * 30),
  flowWorkerBatch: z.number().int().min(1).max(50),
  callApiDefaultTimeoutMs: z.number().int().min(1).max(3_600_000),
  callApiMaxTimeoutMs: z.number().int().min(1).max(3_600_000).nullable(),
  llmAgentMaxToolRounds: z.number().int().min(1).max(100),
  chatSqlRequired: z.boolean(),
  sessionUserCheckIntervalMs: z.number().int().min(10_000).max(86_400_000),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  version: 1,
  flowProcessBudgetMs: 0,
  flowStopAfterFirstMatch: false,
  webhookMaxDurationSec: 60,
  webhookFlowAsync: false,
  webhookFlowDedupeOnSuccessOnly: false,
  webhookFlowQueueMax: 5000,
  flowWorkerDlqMax: 2000,
  flowWorkerMaxAttempts: 3,
  flowWorkerRetryDelayMs: 0,
  webhookFlowDedupeTtlSec: 86400,
  flowWorkerBatch: 8,
  callApiDefaultTimeoutMs: 60_000,
  callApiMaxTimeoutMs: null,
  llmAgentMaxToolRounds: 8,
  chatSqlRequired: false,
  sessionUserCheckIntervalMs: 120_000,
};

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const k of Object.keys(patch)) {
    const pv = patch[k as keyof T];
    if (pv === undefined) continue;
    const bv = base[k as keyof T];
    if (
      pv &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      bv &&
      typeof bv === 'object' &&
      !Array.isArray(bv) &&
      !(pv instanceof Date)
    ) {
      out[k] = deepMerge(bv as Record<string, unknown>, pv as Record<string, unknown>);
    } else {
      out[k] = pv as unknown;
    }
  }
  return out as T;
}

export function mergePlatformSettings(raw: unknown): PlatformSettings {
  const patch = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const merged = deepMerge(
    DEFAULT_PLATFORM_SETTINGS as unknown as Record<string, unknown>,
    patch,
  );
  const parsed = platformSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_PLATFORM_SETTINGS;
}

let cache: PlatformSettings | null = null;
let cacheAt = 0;
const CACHE_MS = 5000;

export function invalidatePlatformSettingsCache(): void {
  cache = null;
  cacheAt = 0;
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_MS) return cache;

  let parsed: unknown = {};
  try {
    const row = await db.queryOne<{ settings_json: string }>(
      'SELECT settings_json FROM platform_settings WHERE id = ?',
      ['default'],
    );
    if (row?.settings_json) {
      try {
        parsed = JSON.parse(row.settings_json) as unknown;
      } catch {
        parsed = {};
      }
    }
  } catch (e) {
    console.warn('[platform-settings] 读取失败，使用内置默认值（若未跑迁移请先执行 upgrade）', e);
    cache = DEFAULT_PLATFORM_SETTINGS;
    cacheAt = now;
    return DEFAULT_PLATFORM_SETTINGS;
  }
  const merged = mergePlatformSettings(parsed);
  cache = merged;
  cacheAt = now;
  return merged;
}

export async function savePlatformSettings(settings: PlatformSettings): Promise<void> {
  const now = new Date().toISOString();
  const json = JSON.stringify(settings);
  if (getSqlDialect() === 'mysql') {
    await db.execute(
      `INSERT INTO platform_settings (id, settings_json, updated_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), updated_at = VALUES(updated_at)`,
      ['default', json, now],
    );
  } else {
    await db.execute(
      `INSERT INTO platform_settings (id, settings_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`,
      ['default', json, now],
    );
  }
  invalidatePlatformSettingsCache();
}

export function redactPlatformSecrets(s: PlatformSettings): PlatformSettings {
  return structuredClone(s);
}
