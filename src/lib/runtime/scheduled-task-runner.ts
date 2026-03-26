import { adapterRegistry, flowProcessor } from '@/core';
import type { NoticeEvent, ScheduledTask } from '@/types';
import { storage } from '@/lib/persistence';
import { getPlatformSettings } from '@/lib/platform-settings';
import '@/adapters';

export function buildCronSyntheticNotice(task: ScheduledTask, botPlatform: string): NoticeEvent {
  return {
    id: `cron:${task.id}:${Date.now()}`,
    type: 'notice',
    subType: 'custom',
    platform: botPlatform,
    botId: task.botId,
    timestamp: Date.now(),
    sender: { userId: 'scheduled_task', role: 'admin' },
    raw: { scheduledTaskId: task.id },
  };
}

export async function runScheduledTaskExecution(
  task: ScheduledTask,
  traceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const job = await storage.getJobForUser(task.jobId, task.ownerId);
  if (!job?.enabled) return { ok: false, error: 'job_missing_or_disabled' };

  const botConfig = await storage.getBot(task.botId);
  if (!botConfig?.enabled) return { ok: false, error: 'bot_missing_or_disabled' };

  const bOwner = botConfig.ownerId ?? null;
  if (bOwner != null && bOwner !== task.ownerId) return { ok: false, error: 'bot_owner_mismatch' };

  const adapter = adapterRegistry.get(botConfig.platform);
  if (!adapter) return { ok: false, error: 'no_adapter' };

  const bot = adapter.getOrCreateBot(botConfig);
  const event = buildCronSyntheticNotice(task, botConfig.platform);

  const pl = await getPlatformSettings();
  const budgetMs = pl.flowProcessBudgetMs;
  const flowDeadlineAt =
    Number.isFinite(budgetMs) && budgetMs > 0 ? Date.now() + budgetMs : undefined;

  try {
    const result = await flowProcessor.runStandaloneJob(job, bot, event, {
      traceId,
      flowDeadlineAt,
      variables: {
        scheduledTaskId: task.id,
        cronFiredAt: Date.now(),
      },
    });
    if (result.error) return { ok: false, error: result.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
