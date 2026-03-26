import { getKvRedis } from '@/lib/data-layer';
import type { BotEvent } from '@/types';
import { getPlatformSettings } from '@/lib/platform-settings';

export const FLOW_WEBHOOK_QUEUE_KEY = 'flow:webhook:queue';
export const FLOW_WEBHOOK_DLQ_KEY = 'flow:webhook:dlq';
export const FLOW_WEBHOOK_RETRY_ZKEY = 'flow:webhook:retry_z';

const DEFAULT_QUEUE_MAX = 5000;
const DEFAULT_DLQ_MAX = 2000;

export type WebhookFlowQueuePayload = {
  v: 2;
  platform: string;
  botId: string;
  traceId: string;
  event: BotEvent;
  enqueuedAt: number;
  /** 当前是第几次执行（从 1 开始） */
  attempt?: number;
};

export type FlowWorkerDlqEntry =
  | {
      v: 1;
      kind: 'failed';
      payload: WebhookFlowQueuePayload;
      attempts: number;
      lastError: string;
      failedAt: number;
      traceId: string;
    }
  | {
      v: 1;
      kind: 'corrupt';
      raw: string;
      reason: string;
      failedAt: number;
    };

async function queueCap(): Promise<number> {
  const s = await getPlatformSettings();
  const n = s.webhookFlowQueueMax;
  return Number.isFinite(n) && n > 10 ? Math.floor(n) : DEFAULT_QUEUE_MAX;
}

async function dlqCap(): Promise<number> {
  const s = await getPlatformSettings();
  const n = s.flowWorkerDlqMax;
  return Number.isFinite(n) && n > 10 ? Math.floor(n) : DEFAULT_DLQ_MAX;
}

export async function flowWorkerMaxAttempts(): Promise<number> {
  const s = await getPlatformSettings();
  const n = s.flowWorkerMaxAttempts;
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 50) : 3;
}

export async function flowWorkerRetryDelayMs(): Promise<number> {
  const s = await getPlatformSettings();
  const n = s.flowWorkerRetryDelayMs;
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), 3_600_000) : 0;
}

function normalizePayload(p: WebhookFlowQueuePayload): WebhookFlowQueuePayload {
  return {
    v: 2,
    platform: p.platform,
    botId: p.botId,
    traceId: p.traceId,
    event: p.event,
    enqueuedAt: p.enqueuedAt,
    attempt: p.attempt ?? 1,
  };
}

function serializePayload(p: WebhookFlowQueuePayload): string {
  return JSON.stringify(normalizePayload(p));
}

function parseQueueLine(raw: string): WebhookFlowQueuePayload | null {
  try {
    const o = JSON.parse(raw) as WebhookFlowQueuePayload;
    if (o?.v !== 2 || !o.platform || !o.botId || !o.event?.id) return null;
    return normalizePayload(o);
  } catch {
    return null;
  }
}

async function pushDlqLine(line: string): Promise<void> {
  const kv = getKvRedis();
  await kv.rpush(FLOW_WEBHOOK_DLQ_KEY, line);
  const cap = await dlqCap();
  await kv.ltrim(FLOW_WEBHOOK_DLQ_KEY, -cap, -1);
}

async function pushCorruptDlq(raw: string, reason: string): Promise<void> {
  const entry: FlowWorkerDlqEntry = {
    v: 1,
    kind: 'corrupt',
    raw: raw.length > 8000 ? `${raw.slice(0, 8000)}…` : raw,
    reason,
    failedAt: Date.now(),
  };
  await pushDlqLine(JSON.stringify(entry));
}

export async function pushFailedDlq(
  payload: WebhookFlowQueuePayload,
  attempts: number,
  lastError: string,
  traceId: string,
): Promise<void> {
  const entry: FlowWorkerDlqEntry = {
    v: 1,
    kind: 'failed',
    payload: normalizePayload(payload),
    attempts,
    lastError: lastError.length > 4000 ? `${lastError.slice(0, 4000)}…` : lastError,
    failedAt: Date.now(),
    traceId,
  };
  await pushDlqLine(JSON.stringify(entry));
}

/** 将已到期的延时重试项移入主队列 */
export async function promoteDueRetryJobs(): Promise<number> {
  const kv = getKvRedis();
  const now = Date.now();
  const lines = await kv.zrangeByScore(FLOW_WEBHOOK_RETRY_ZKEY, '-inf', String(now), {
    offset: 0,
    count: 100,
  });
  let n = 0;
  for (const line of lines) {
    await kv.zrem(FLOW_WEBHOOK_RETRY_ZKEY, line);
    await kv.rpush(FLOW_WEBHOOK_QUEUE_KEY, line);
    n++;
  }
  if (n > 0) {
    const cap = await queueCap();
    await kv.ltrim(FLOW_WEBHOOK_QUEUE_KEY, -cap, -1);
  }
  return n;
}

export async function scheduleWebhookFlowRetry(payload: WebhookFlowQueuePayload): Promise<void> {
  const line = serializePayload(payload);
  const delay = await flowWorkerRetryDelayMs();
  const kv = getKvRedis();
  const qmax = await queueCap();
  if (delay <= 0) {
    await kv.rpush(FLOW_WEBHOOK_QUEUE_KEY, line);
    await kv.ltrim(FLOW_WEBHOOK_QUEUE_KEY, -qmax, -1);
    return;
  }
  const when = Date.now() + delay;
  await kv.zadd(FLOW_WEBHOOK_RETRY_ZKEY, when, line);
}

export async function enqueueWebhookFlowJob(payload: WebhookFlowQueuePayload): Promise<void> {
  const kv = getKvRedis();
  const line = serializePayload(payload);
  await kv.rpush(FLOW_WEBHOOK_QUEUE_KEY, line);
  const cap = await queueCap();
  await kv.ltrim(FLOW_WEBHOOK_QUEUE_KEY, -cap, -1);
}

export async function dequeueWebhookFlowJob(): Promise<WebhookFlowQueuePayload | null> {
  const raw = await getKvRedis().lpop(FLOW_WEBHOOK_QUEUE_KEY);
  if (!raw) return null;
  const job = parseQueueLine(raw);
  if (!job) {
    await pushCorruptDlq(raw, 'invalid_queue_payload');
    return null;
  }
  return job;
}

export function webhookDedupeKey(platform: string, botId: string, eventId: string): string {
  return `flow:webhook:dedupe:${platform}:${botId}:${eventId}`;
}

export async function webhookFlowDedupeTtlSec(): Promise<number> {
  const s = await getPlatformSettings();
  const ttl = s.webhookFlowDedupeTtlSec;
  return Number.isFinite(ttl) && ttl > 60 ? Math.floor(ttl) : 86400;
}

/**
 * @returns true 表示首次占用该 eventId，可放入队列；false 表示短期内重复投递
 */
export async function tryMarkWebhookEventDedupe(
  platform: string,
  botId: string,
  eventId: string,
  ttlSec?: number,
): Promise<boolean> {
  const sec = ttlSec ?? (await webhookFlowDedupeTtlSec());
  const key = webhookDedupeKey(platform, botId, eventId);
  const r = await getKvRedis().set(key, '1', { nx: true, ex: sec });
  return r != null;
}

/** 仅在 Flow 成功结束后写入去重键时使用 */
export async function markWebhookFlowDedupeAfterSuccess(
  platform: string,
  botId: string,
  eventId: string,
  ttlSec?: number,
): Promise<void> {
  const sec = ttlSec ?? (await webhookFlowDedupeTtlSec());
  const key = webhookDedupeKey(platform, botId, eventId);
  await getKvRedis().set(key, '1', { ex: sec });
}

export async function getFlowQueueMetrics(): Promise<{
  queueLen: number;
  dlqLen: number;
  retryDueCount: number;
  retryScheduledTotal: number;
}> {
  const kv = getKvRedis();
  const now = Date.now();
  const [queueLen, dlqLen, retryDueCount, retryScheduledTotal] = await Promise.all([
    kv.llen(FLOW_WEBHOOK_QUEUE_KEY),
    kv.llen(FLOW_WEBHOOK_DLQ_KEY),
    kv.zcount(FLOW_WEBHOOK_RETRY_ZKEY, '-inf', String(now)),
    kv.zcount(FLOW_WEBHOOK_RETRY_ZKEY, '-inf', '+inf'),
  ]);
  return { queueLen, dlqLen, retryDueCount, retryScheduledTotal };
}
