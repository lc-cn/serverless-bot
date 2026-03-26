import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiRequirePermission } from '@/lib/auth/permissions';
import {
  getPlatformSettings,
  savePlatformSettings,
  platformSettingsSchema,
  type PlatformSettings,
  redactPlatformSecrets,
} from '@/lib/platform-settings';

const patchSchema = z
  .object({
    flowProcessBudgetMs: z.number().int().min(0).max(86_400_000).optional(),
    flowStopAfterFirstMatch: z.boolean().optional(),
    webhookMaxDurationSec: z.number().int().min(1).max(300).optional(),
    webhookFlowAsync: z.boolean().optional(),
    webhookFlowDedupeOnSuccessOnly: z.boolean().optional(),
    webhookFlowQueueMax: z.number().int().min(11).max(1_000_000).optional(),
    flowWorkerDlqMax: z.number().int().min(11).max(500_000).optional(),
    flowWorkerMaxAttempts: z.number().int().min(1).max(50).optional(),
    flowWorkerRetryDelayMs: z.number().int().min(0).max(3_600_000).optional(),
    webhookFlowDedupeTtlSec: z.number().int().min(61).max(86_400 * 30).optional(),
    flowWorkerBatch: z.number().int().min(1).max(50).optional(),
    callApiDefaultTimeoutMs: z.number().int().min(1).max(3_600_000).optional(),
    callApiMaxTimeoutMs: z.number().int().min(1).max(3_600_000).nullable().optional(),
    llmAgentMaxToolRounds: z.number().int().min(1).max(100).optional(),
    chatSqlRequired: z.boolean().optional(),
    sessionUserCheckIntervalMs: z.number().int().min(10_000).max(86_400_000).optional(),
  })
  .optional();

export async function GET() {
  const { error } = await apiRequirePermission('system:platform_settings');
  if (error) return error;
  const settings = await getPlatformSettings();
  return NextResponse.json({ settings: redactPlatformSecrets(settings) });
}

export async function PATCH(req: NextRequest) {
  const { error } = await apiRequirePermission('system:platform_settings');
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || !parsed.data || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'validation_error' }, { status: 400 });
  }

  const current = await getPlatformSettings();

  const candidate: PlatformSettings = {
    ...current,
    ...parsed.data,
  };

  const valid = platformSettingsSchema.safeParse(candidate);
  if (!valid.success) {
    return NextResponse.json({ error: 'invalid_settings' }, { status: 400 });
  }

  await savePlatformSettings(valid.data);
  const saved = await getPlatformSettings();
  return NextResponse.json({ settings: redactPlatformSecrets(saved) });
}
