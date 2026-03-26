import { NextRequest, NextResponse } from 'next/server';
import { adapterRegistry, type WebhookResponse } from '@/core';
import { processWechatMpWebhook } from '@/adapters/wechat-mp/inbound';
import { storage } from '@/lib/persistence';
import { getOrCreateTraceId } from '@/lib/runtime/request-trace';
import { QQAdapter } from '@/adapters/qq';
import {
  cacheWebhookChatDirectory,
  runWebhookFlowPipeline,
} from '@/lib/webhook/process-webhook-flows';
import {
  enqueueWebhookFlowJob,
  tryMarkWebhookEventDedupe,
} from '@/lib/webhook/webhook-flow-queue';
import { isWebhookFlowAsync, isWebhookFlowDedupeOnSuccessOnly } from '@/lib/webhook/webhook-env';
import { wechatMpPassiveReplyStorage } from '@/lib/runtime/wechat-mp-passive-context';

// 确保适配器被注册
import '@/adapters';

export const maxDuration = 300;
/** AsyncLocalStorage（微信被动密文回复）依赖 Node runtime */
export const runtime = 'nodejs';

function nextResponseFromWebhook(webhookResponse: WebhookResponse): NextResponse {
  if (typeof webhookResponse.body === 'string') {
    return new NextResponse(webhookResponse.body, {
      status: webhookResponse.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...webhookResponse.headers,
      },
    });
  }
  return new NextResponse(JSON.stringify(webhookResponse.body), {
    status: webhookResponse.status,
    headers: {
      'Content-Type': 'application/json',
      ...webhookResponse.headers,
    },
  });
}

interface RouteParams {
  params: Promise<{
    platform: string;
    bot_id: string;
  }>;
}

/**
 * Webhook 处理入口
 * 接收来自各平台的事件，交付到对应的 Adapter 处理
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params;
  const { platform, bot_id: botId } = resolvedParams;
  const traceId = getOrCreateTraceId(request.headers);

  try {
    console.info(`[trace:${traceId}] [Webhook] Incoming request`, { platform, botId });
    // 1. 获取 Adapter
    const adapter = adapterRegistry.get(platform);
    if (!adapter) {
      console.error(`[trace:${traceId}] [Webhook] Adapter not found`, { platform });
      return NextResponse.json(
        { error: 'Platform not supported' },
        { status: 404 }
      );
    }

    // 2. 获取 Bot 配置
    const botConfig = await storage.getBot(botId);
    if (!botConfig) {
      console.error(`[trace:${traceId}] [Webhook] Bot not found`, { botId });
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
    }

    if (botConfig.platform !== platform) {
      console.error(`[trace:${traceId}] [Webhook] Platform mismatch`, {
        path: platform,
        botPlatform: botConfig.platform,
        botId,
      });
      return NextResponse.json({ error: 'Platform mismatch' }, { status: 400 });
    }

    if (!botConfig.enabled) {
      console.warn('[Webhook] Bot disabled', { botId });
      return NextResponse.json(
        { error: 'Bot is disabled' },
        { status: 403 }
      );
    }

    // 3. 获取 Adapter 配置
    const adapterConfig = await storage.getAdapter(platform);
    console.debug('[Webhook] Adapter/Bot config loaded', { hasAdapterConfig: !!adapterConfig, botName: botConfig.name });

    const query: Record<string, string> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // 4. 解析请求数据
    // 关键：必须保存原始的 body 字符串用于签名验证！
    const bodyText = await request.text();
    let rawData: any;
    if (platform === 'wechat_mp') {
      const w = processWechatMpWebhook(bodyText, botConfig.config || {}, query);
      if (!w.ok) {
        console.error('[Webhook] WeChat MP verify/decrypt failed', { botId });
        return NextResponse.json({ error: 'Verification failed' }, { status: 401 });
      }
      rawData = w.fields;
    } else {
      try {
        rawData = bodyText ? JSON.parse(bodyText) : null;
      } catch (e) {
        console.error('[Webhook] Failed to parse body as JSON', e);
        return NextResponse.json(
          { error: 'Invalid JSON' },
          { status: 400 }
        );
      }
    }

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.debug('[Webhook] Headers snapshot', Object.keys(headers));

    // 5. 验证 Webhook（微信已在上方完成验签 + 解密）
    console.debug('[Webhook] Bot config keys:', Object.keys(botConfig.config || {}));
    if (platform !== 'wechat_mp') {
      const isValid = await adapter.verifyWebhook(
        bodyText,
        headers,
        botConfig.config || {},
        query
      );

      if (!isValid) {
        console.error('[Webhook] Verification failed', { botId });
        return NextResponse.json(
          { error: 'Verification failed' },
          { status: 401 }
        );
      }
    }
    console.info(`[trace:${traceId}] [Webhook] Verification passed`);
    const webhookAsync = await isWebhookFlowAsync();

    const continueWebhook = async (): Promise<NextResponse> => {
    // 6.5 特殊处理 QQ 回调地址验证（op=13）
    if (platform === 'qq' && rawData?.op === 13) {
      const data = rawData.d;
      const plainToken = data?.plain_token;
      const eventTs = data?.event_ts;
      const appSecret = botConfig.config?.appSecret as string;

      if (appSecret && plainToken && eventTs) {
        const validationResponse = QQAdapter.generateValidationResponse(appSecret, plainToken, eventTs);
        console.log('[Webhook] QQ callback validation response:', validationResponse);
        return NextResponse.json(validationResponse);
      }
    }

    // 6. 解析事件
    const event = await adapter.parseEvent(botId, rawData as any, headers);

    if (!event) {
      console.warn('[Webhook] Event parse returned null', { botId });
      // 返回成功响应，因为可能是不需要处理的事件类型
      // 对于 Discord，需要返回特定的 PING 响应格式
      const webhookResponse = adapter.getWebhookResponse(rawData as any);
      console.log('[Webhook] Response to send:', {
        status: webhookResponse.status,
        body: webhookResponse.body,
        headers: webhookResponse.headers,
      });
      return nextResponseFromWebhook(webhookResponse);
    }
    console.info('[Webhook] Event parsed', { type: event.type, subType: event.subType, sender: event.sender?.userId, groupId: (event as any).groupId });

    // 7. 获取或创建 Bot 实例
    const bot = adapter.getOrCreateBot(botConfig);
    console.debug('[Webhook] Bot instance ready', { platform: bot.platform, botId: bot.id });

    // 8. 加载 Flow、Job 和 Trigger 配置（Bot 有 ownerId 时仅加载全局 + 该用户数据）
    const botOwnerId = botConfig.ownerId ?? null;
    const { flows, jobs, triggers } = await storage.getWebhookFlowRuntimeSnapshot(botOwnerId);
    
    console.debug('[Webhook] Flows loaded', flows.map(f => ({ id: f.id, name: f.name, triggerIds: f.triggerIds, eventType: f.eventType })));
    console.debug('[Webhook] Jobs loaded', jobs.map(j => ({ id: j.id, name: j.name, stepCount: j.steps.length })));
    console.debug('[Webhook] Triggers loaded', triggers.map(t => ({ id: t.id, name: t.name, eventType: t.eventType, matchType: t.match.type, matchPattern: t.match.pattern })));
    
    console.debug(`[trace:${traceId}] [Webhook] Flows, Jobs and Triggers loaded`, {
      flows: flows.length,
      jobs: jobs.length,
      triggers: triggers.length,
    });

    // 9. 预处理：缓存联系人/群组，便于聊天面板读取
    try {
      await cacheWebhookChatDirectory({ platform, botId, event });
    } catch (cacheErr) {
      console.warn('[Webhook] cache contacts/groups failed', cacheErr);
    }

    // 10. 处理事件（同步）或异步入队（平台设置 webhookFlowAsync）
    const asyncFlow = webhookAsync;
    const dedupeAfterSuccess = await isWebhookFlowDedupeOnSuccessOnly();
    let results: Awaited<ReturnType<typeof runWebhookFlowPipeline>>;
    if (asyncFlow) {
      if (dedupeAfterSuccess) {
        await enqueueWebhookFlowJob({
          v: 2,
          platform,
          botId,
          traceId,
          event,
          enqueuedAt: Date.now(),
          attempt: 1,
        });
        console.info(`[trace:${traceId}] [Webhook] Event enqueued (dedupe after success)`, { eventId: event.id });
        results = [];
      } else {
        const first = await tryMarkWebhookEventDedupe(platform, botId, event.id);
        if (!first) {
          console.info(`[trace:${traceId}] [Webhook] Duplicate event skipped (async)`, { eventId: event.id });
          results = [];
        } else {
          await enqueueWebhookFlowJob({
            v: 2,
            platform,
            botId,
            traceId,
            event,
            enqueuedAt: Date.now(),
            attempt: 1,
          });
          console.info(`[trace:${traceId}] [Webhook] Event enqueued for async flow`, { eventId: event.id });
          results = [];
        }
      }
    } else {
      results = await runWebhookFlowPipeline({ platform, botId, event, bot, traceId });
      console.info(`[trace:${traceId}] [Webhook] Event processed`, {
        eventId: event.id,
        eventType: event.type,
        flowResults: results.map((r) => ({
          flowId: r.flowId,
          matched: r.matched,
          executed: r.executed,
          duration: r.duration,
        })),
      });
    }

    // 11. 记录执行结果（可选：存储到日志）
    console.log(`[trace:${traceId}] Event processed for bot ${botId}:`, {
      eventId: event.id,
      eventType: event.type,
      flowResults: results.map((r) => ({
        flowId: r.flowId,
        matched: r.matched,
        executed: r.executed,
        duration: r.duration,
      })),
    });

    // 12. 返回响应
    const webhookResponse = adapter.getWebhookResponse(rawData as any);
    return nextResponseFromWebhook(webhookResponse);
    };

    if (platform === 'wechat_mp') {
      const cfg = botConfig.config || {};
      const aes = String(cfg.encodingAESKey || '').trim();
      return wechatMpPassiveReplyStorage.run(
        {
          inboundFields: rawData as Record<string, string>,
          token: String(cfg.token || ''),
          appId: String(cfg.appId || '').trim(),
          encodingAESKey: aes,
          useEncryptedPassiveReply: !!aes && !webhookAsync,
        },
        continueWebhook
      );
    }

    return continueWebhook();
  } catch (error) {
    console.error(`[trace:${traceId}] [Webhook] error`, { platform, botId, error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 处理 GET 请求（某些平台用于验证 webhook）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params;
  const { platform, bot_id: botId } = resolvedParams;

  try {
    const adapter = adapterRegistry.get(platform);
    if (!adapter) {
      return NextResponse.json(
        { error: 'Platform not supported' },
        { status: 404 }
      );
    }

    const botConfig = await storage.getBot(botId);
    if (!botConfig) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    if (botConfig.platform !== platform) {
      return NextResponse.json({ error: 'Platform mismatch' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      query[key] = value;
    });

    const getResult = adapter.handleWebhookGet?.(query, botConfig.config || {});
    if (getResult) {
      if (getResult.type === 'plain') {
        return new NextResponse(getResult.body, {
          status: getResult.status ?? 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            ...getResult.headers,
          },
        });
      }
      return NextResponse.json(getResult.body, {
        status: getResult.status ?? 200,
        headers: getResult.headers,
      });
    }

    return NextResponse.json({
      status: 'ok',
      platform,
      botId,
    });
  } catch (error) {
    console.error(`Webhook GET error for ${platform}/${botId}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
