import { NextRequest, NextResponse } from 'next/server';
import { adapterRegistry } from '@/core';
import { storage } from '@/lib/persistence';
import { runWebhookFlowPipeline } from '@/lib/webhook/process-webhook-flows';
import {
  dequeueWebhookFlowJob,
  flowWorkerMaxAttempts,
  promoteDueRetryJobs,
  pushFailedDlq,
  scheduleWebhookFlowRetry,
  type WebhookFlowQueuePayload,
} from '@/lib/webhook/webhook-flow-queue';
import { assertFlowWorkerAuthorized } from '@/lib/webhook/webhook-env';
import { getKvBackendKind } from '@/lib/data-layer';
import { getPlatformSettings } from '@/lib/platform-settings';

import '@/adapters';

export const maxDuration = 300;

function logWorkerJob(meta: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      event: 'flow_worker_job',
      ...meta,
    }),
  );
}

export async function POST(request: NextRequest) {
  if (!assertFlowWorkerAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pl = await getPlatformSettings();
  const rawBatch = pl.flowWorkerBatch;
  const batchCap = Number.isFinite(rawBatch) && rawBatch > 0 ? Math.min(Math.floor(rawBatch), 50) : 8;

  const promoted = await promoteDueRetryJobs();

  let processed = 0;
  let retried = 0;
  let dlqPushed = 0;
  const errors: string[] = [];

  const maxA = await flowWorkerMaxAttempts();

  for (let i = 0; i < batchCap; i++) {
    const job = await dequeueWebhookFlowJob();
    if (!job) break;

    const attempt = job.attempt ?? 1;
    const t0 = Date.now();

    const finishSkip = async (reason: string) => {
      errors.push(reason);
      await pushFailedDlq(job, attempt, reason, job.traceId);
      dlqPushed++;
      logWorkerJob({
        traceId: job.traceId,
        outcome: 'skip',
        durationMs: Date.now() - t0,
        attempt,
        platform: job.platform,
        botId: job.botId,
        eventId: job.event.id,
        reason,
      });
      processed++;
    };

    try {
      const botConfig = await storage.getBot(job.botId);
      if (!botConfig || !botConfig.enabled) {
        console.warn('[FlowWorker] skip disabled or missing bot', job.botId);
        await finishSkip('bot_disabled_or_missing');
        continue;
      }
      if (botConfig.platform !== job.platform) {
        errors.push(`platform mismatch ${job.botId}`);
        await finishSkip('platform_mismatch');
        continue;
      }

      const adapter = adapterRegistry.get(job.platform);
      if (!adapter) {
        errors.push(`no adapter ${job.platform}`);
        await finishSkip('no_adapter');
        continue;
      }

      const bot = adapter.getOrCreateBot(botConfig);
      await runWebhookFlowPipeline({
        platform: job.platform,
        botId: job.botId,
        event: job.event,
        bot,
        traceId: job.traceId,
      });

      logWorkerJob({
        traceId: job.traceId,
        outcome: 'ok',
        durationMs: Date.now() - t0,
        attempt,
        platform: job.platform,
        botId: job.botId,
        eventId: job.event.id,
      });
      processed++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      console.error('[FlowWorker] job failed', e);

      if (attempt >= maxA) {
        await pushFailedDlq(job, attempt, msg, job.traceId);
        dlqPushed++;
        logWorkerJob({
          traceId: job.traceId,
          outcome: 'dlq',
          durationMs: Date.now() - t0,
          attempt,
          platform: job.platform,
          botId: job.botId,
          eventId: job.event.id,
          lastError: msg,
        });
      } else {
        const next: WebhookFlowQueuePayload = {
          ...job,
          v: 2,
          attempt: attempt + 1,
        };
        await scheduleWebhookFlowRetry(next);
        retried++;
        logWorkerJob({
          traceId: job.traceId,
          outcome: 'retry',
          durationMs: Date.now() - t0,
          attempt,
          platform: job.platform,
          botId: job.botId,
          eventId: job.event.id,
          nextAttempt: attempt + 1,
          lastError: msg,
        });
      }
      processed++;
    }
  }

  return NextResponse.json({
    ok: true,
    promotedRetries: promoted,
    processed,
    retried,
    dlqPushed,
    errors,
    kvBackend: getKvBackendKind(),
  });
}
