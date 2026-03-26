import { getPlatformSettings } from '@/lib/platform-settings';

export async function isWebhookFlowAsync(): Promise<boolean> {
  const s = await getPlatformSettings();
  return s.webhookFlowAsync;
}

export async function isWebhookFlowDedupeOnSuccessOnly(): Promise<boolean> {
  const s = await getPlatformSettings();
  return s.webhookFlowDedupeOnSuccessOnly;
}

/** Next.js / Vercel Route `maxDuration`（秒）；业务参考值，实际 `export const maxDuration` 仍以部署配置为准 */
export async function resolveWebhookMaxDurationSec(): Promise<number> {
  const s = await getPlatformSettings();
  const n = s.webhookMaxDurationSec;
  if (!Number.isFinite(n) || n < 1) return 60;
  return Math.min(Math.floor(n), 300);
}

export function assertFlowWorkerAuthorized(request: Request): boolean {
  const secret = process.env.FLOW_WORKER_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  return request.headers.get('x-flow-worker-secret') === secret;
}
