import { flowProcessor } from '@/core';
import { appendEventLog } from '@/lib/kv/kv-logs';
import { getChatStore, storage } from '@/lib/persistence';
import { getPlatformSettings } from '@/lib/platform-settings';
import type { Bot } from '@/core/bot';
import type { BotEvent } from '@/types';
import { markWebhookFlowDedupeAfterSuccess } from '@/lib/webhook/webhook-flow-queue';

/** Webhook 收到消息事件时预热联系人/群组缓存（与面板一致） */
export async function cacheWebhookChatDirectory(params: {
  platform: string;
  botId: string;
  event: BotEvent;
}): Promise<void> {
  const { platform, botId, event } = params;
  if (event.type !== 'message') return;
  const store = getChatStore();
  if (event.sender?.userId) {
    await store.upsertContact({
      platform,
      botId,
      contact: {
        id: event.sender.userId,
        name: event.sender.nickname || event.sender.userId,
        role: event.sender.role,
      },
      groupId: event.subType === 'group' ? String((event as { groupId?: string }).groupId || '') : undefined,
    });
  }
  const groupId = (event as { groupId?: string }).groupId;
  if (groupId) {
    await store.upsertGroup({
      platform,
      botId,
      group: { id: String(groupId), name: String(groupId) },
    });
  }
}

/** 加载快照并执行 Flow + 事件日志（Webhook 同步路径与异步 worker 共用） */
export async function runWebhookFlowPipeline(params: {
  platform: string;
  botId: string;
  event: BotEvent;
  bot: Bot;
  traceId: string;
}): Promise<Awaited<ReturnType<typeof flowProcessor.process>>> {
  const { platform, botId, event, bot, traceId } = params;
  const owner = bot.ownerId ?? null;
  const { flows, jobs, triggers } = await storage.getWebhookFlowRuntimeSnapshot(owner);

  const results = await flowProcessor.process(event, bot, { flows, jobs, triggers }, { traceId });

  try {
    await appendEventLog(platform, botId, {
      id: event.id,
      type: event.type,
      subType: (event as { subType?: string }).subType,
      platform,
      botId,
      timestamp: Date.now(),
      sender: { userId: (event as { sender?: { userId?: string } })?.sender?.userId },
      summary: {
        flowResults: results.map((r) => ({
          flowId: r.flowId,
          matched: r.matched,
          executed: r.executed,
          duration: r.duration,
          error: r.error,
        })),
      },
    });
  } catch (e) {
    console.warn('[Webhook] appendEventLog failed', e);
  }

  if ((await getPlatformSettings()).webhookFlowDedupeOnSuccessOnly) {
    try {
      await markWebhookFlowDedupeAfterSuccess(platform, botId, event.id);
    } catch (e) {
      console.warn('[Webhook] markWebhookFlowDedupeAfterSuccess failed', e);
    }
  }

  return results;
}
