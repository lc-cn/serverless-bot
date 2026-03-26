import { z } from 'zod';
import { db } from '@/lib/data-layer';
import { getSqlDialect } from '@/lib/database/sql-dialect';

const providerGithubSchema = z.object({
  enabled: z.boolean(),
  allowBind: z.boolean(),
  allowSignup: z.boolean(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

const providerPasskeySchema = z.object({
  enabled: z.boolean(),
  allowBind: z.boolean(),
  allowSignup: z.boolean(),
  rpId: z.string().optional(),
  rpName: z.string().optional(),
});

/** 邮件模板：占位符如 {{code}}、{{link}}、{{name}} 可在业务发送时替换 */
const emailTemplateSchema = z.object({
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});

const emailSmtpSchema = z.object({
  host: z.string(),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string(),
  password: z.string().optional(),
  fromEmail: z.string(),
  fromName: z.string(),
});

const emailSettingsSchema = z.object({
  enabled: z.boolean(),
  smtp: emailSmtpSchema,
  templates: z.object({
    verification: emailTemplateSchema,
    passwordReset: emailTemplateSchema,
    generic: emailTemplateSchema,
  }),
});

export const authSettingsSchema = z.object({
  version: z.number(),
  registrationEnabled: z.boolean(),
  providers: z.object({
    github: providerGithubSchema,
    passkey: providerPasskeySchema,
  }),
  email: emailSettingsSchema,
});

export type AuthSettings = z.infer<typeof authSettingsSchema>;

const emptyTemplate = (): z.infer<typeof emailTemplateSchema> => ({
  subject: '',
  html: '',
  text: '',
});

export const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  version: 2,
  registrationEnabled: true,
  providers: {
    github: {
      enabled: true,
      allowBind: true,
      allowSignup: true,
    },
    passkey: {
      enabled: false,
      allowBind: true,
      allowSignup: false,
    },
  },
  email: {
    enabled: false,
    smtp: {
      host: '',
      port: 587,
      secure: false,
      user: '',
      fromEmail: '',
      fromName: '',
    },
    templates: {
      verification: emptyTemplate(),
      passwordReset: emptyTemplate(),
      generic: emptyTemplate(),
    },
  },
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
      !Array.isArray(bv)
    ) {
      out[k] = deepMerge(bv as Record<string, unknown>, pv as Record<string, unknown>);
    } else {
      out[k] = pv as unknown;
    }
  }
  return out as T;
}

export function mergeAuthSettings(raw: unknown): AuthSettings {
  const merged = deepMerge(
    DEFAULT_AUTH_SETTINGS as unknown as Record<string, unknown>,
    (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>,
  );
  const parsed = authSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_AUTH_SETTINGS;
}

export async function getAuthSettingsRow(): Promise<{ settingsJson: string; updatedAt: string } | null> {
  const row = await db.queryOne<{ settings_json: string; updated_at: string }>(
    'SELECT settings_json, updated_at FROM auth_settings WHERE id = ?',
    ['default'],
  );
  if (!row) return null;
  return { settingsJson: row.settings_json, updatedAt: row.updated_at };
}

export async function getAuthSettings(): Promise<AuthSettings> {
  const row = await getAuthSettingsRow();
  if (!row) return DEFAULT_AUTH_SETTINGS;
  try {
    const j = JSON.parse(row.settingsJson) as unknown;
    return mergeAuthSettings(j);
  } catch {
    return DEFAULT_AUTH_SETTINGS;
  }
}

export async function saveAuthSettings(settings: AuthSettings): Promise<void> {
  const now = new Date().toISOString();
  const json = JSON.stringify(settings);
  if (getSqlDialect() === 'mysql') {
    await db.execute(
      `INSERT INTO auth_settings (id, settings_json, updated_at) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE settings_json = VALUES(settings_json), updated_at = VALUES(updated_at)`,
      ['default', json, now],
    );
    return;
  }
  await db.execute(
    `INSERT INTO auth_settings (id, settings_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`,
    ['default', json, now],
  );
}

export async function patchAuthSettings(patch: Partial<AuthSettings>): Promise<AuthSettings> {
  const current = await getAuthSettings();
  const merged = deepMerge(current as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  const next = mergeAuthSettings(merged);
  await saveAuthSettings(next);
  return next;
}
