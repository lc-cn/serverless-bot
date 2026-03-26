import { randomUUID } from 'node:crypto';
import { SandboxBot } from '@/lib/sandbox/sandbox-bot';
import { buildSandboxChatMessageEvent } from '@/lib/sandbox/build-message-event';
import {
  cacheWebhookChatDirectory,
  runWebhookFlowPipeline,
} from '@/lib/webhook/process-webhook-flows';
import type { BotConfig, MessageEvent } from '@/types';
import type { FlowExecutionResult } from '@/core/flow';
import type { SandboxOutboundCapture } from '@/lib/sandbox/sandbox-bot';

/** 虚拟 Bot ID，不落库；以当前登录用户为 owner 加载 Flow 快照 */
export const SANDBOX_CHAT_BOT_ID = 'sandbox_chat';

function now(): number {
  return Date.now();
}

export async function runSandboxChatPipeline(opts: {
  userId: string;
  text: string;
  /** 若省略则内部生成，便于路由提前下发 start 事件 */
  traceId?: string;
}): Promise<{
  traceId: string;
  event: MessageEvent;
  flowResults: FlowExecutionResult[];
  outbound: SandboxOutboundCapture[];
}> {
  const traceId = opts.traceId ?? randomUUID();
  const cfg: BotConfig = {
    id: SANDBOX_CHAT_BOT_ID,
    platform: 'sandbox',
    name: 'Chat',
    enabled: true,
    config: { captureOutbound: true },
    ownerId: opts.userId,
    createdAt: now(),
    updatedAt: now(),
  };
  const bot = new SandboxBot(cfg);
  const event = buildSandboxChatMessageEvent(SANDBOX_CHAT_BOT_ID, {
    text: opts.text,
    subType: 'private',
    senderUserId: 'chat_user',
    senderNickname: '我',
  });

  try {
    await cacheWebhookChatDirectory({ platform: 'sandbox', botId: SANDBOX_CHAT_BOT_ID, event });
  } catch (e) {
    console.warn('[sandbox chat] cacheWebhookChatDirectory', e);
  }

  const flowResults = await runWebhookFlowPipeline({
    platform: 'sandbox',
    botId: SANDBOX_CHAT_BOT_ID,
    event,
    bot,
    traceId,
  });

  return { traceId, event, flowResults, outbound: bot.outboundCaptures };
}

export function serializeFlowResultsForWire(flowResults: FlowExecutionResult[]) {
  return flowResults.map((r) => ({
    flowId: r.flowId,
    matched: r.matched,
    executed: r.executed,
    duration: r.duration,
    error: r.error,
    jobs: r.jobs.map((j) => ({
      jobId: j.jobId,
      executed: j.executed,
      duration: j.duration,
      error: j.error,
      steps: j.steps.map((s) => ({
        stepId: s.stepId,
        success: s.success,
        duration: s.duration,
        error: s.error,
        data: s.data,
      })),
    })),
  }));
}
