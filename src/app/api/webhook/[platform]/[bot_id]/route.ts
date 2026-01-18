import { NextRequest, NextResponse } from 'next/server';
import { adapterRegistry, flowProcessor } from '@/core';
import { storage } from '@/lib/unified-storage';
import { appendEventLog } from '@/lib/kv-logs';
import { getChatStore } from '@/lib/chat-store';
import { QQAdapter } from '@/adapters/qq';

// 确保适配器被注册
import '@/adapters';

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

  try {
    console.info('[Webhook] Incoming request', { platform, botId });
    // 1. 获取 Adapter
    const adapter = adapterRegistry.get(platform);
    if (!adapter) {
      console.error('[Webhook] Adapter not found', { platform });
      return NextResponse.json(
        { error: 'Platform not supported' },
        { status: 404 }
      );
    }

    // 2. 获取 Bot 配置
    const botConfig = await storage.getBot(botId);
    if (!botConfig) {
      console.error('[Webhook] Bot not found', { botId });
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      );
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

    // 4. 解析请求数据
    // 关键：必须保存原始的 body 字符串用于签名验证！
    const bodyText = await request.text();
    let rawData: any;
    try {
      rawData = JSON.parse(bodyText);
    } catch (e) {
      console.error('[Webhook] Failed to parse body as JSON', e);
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }
    
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.debug('[Webhook] Headers snapshot', Object.keys(headers));

    // 5. 验证 Webhook
    // 重要：传递原始的 body 字符串用于 Ed25519 签名验证
    console.log('[Webhook] Bot config keys:', Object.keys(botConfig.config || {}));
    console.log('[Webhook] Bot config:', JSON.stringify(botConfig.config, null, 2));
    const isValid = await adapter.verifyWebhook(
      bodyText,  // ← 传递原始 body 字符串，而不是解析后的对象
      headers,
      botConfig.config || {}
    );

    if (!isValid) {
      console.error('[Webhook] Verification failed', { botId });
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 401 }
      );
    }
    console.info('[Webhook] Verification passed');

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
      // 直接返回，让 Next.js 自动设置 Content-Type
      return new NextResponse(JSON.stringify(webhookResponse.body), {
        status: webhookResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...webhookResponse.headers,
        },
      });
    }
    console.info('[Webhook] Event parsed', { type: event.type, subType: event.subType, sender: event.sender?.userId, groupId: (event as any).groupId });

    // 7. 获取或创建 Bot 实例
    const bot = adapter.getOrCreateBot(botConfig);
    console.debug('[Webhook] Bot instance ready', { platform: bot.platform, botId: bot.id });

    // 8. 加载 Flow、Job 和 Trigger 配置
    const flows = await storage.getFlows();
    const jobs = await storage.getJobs();
    const triggers = await storage.getTriggers();
    
    console.debug('[Webhook] Flows loaded', flows.map(f => ({ id: f.id, name: f.name, triggerIds: f.triggerIds, eventType: f.eventType })));
    console.debug('[Webhook] Jobs loaded', jobs.map(j => ({ id: j.id, name: j.name, stepCount: j.steps.length })));
    console.debug('[Webhook] Triggers loaded', triggers.map(t => ({ id: t.id, name: t.name, eventType: t.eventType, matchType: t.match.type, matchPattern: t.match.pattern })));
    
    flowProcessor.setFlows(flows);
    flowProcessor.setJobs(jobs);
    flowProcessor.setTriggers(triggers);
    console.debug('[Webhook] Flows, Jobs and Triggers loaded', { flows: flows.length, jobs: jobs.length, triggers: triggers.length });

    // 9. 预处理：缓存联系人/群组，便于聊天面板读取
    try {
      if (event.type === 'message') {
        const store = getChatStore();
        if (event.sender?.userId) {
          await store.upsertContact({
            platform,
            botId,
            contact: { id: event.sender.userId, name: event.sender.nickname || event.sender.userId, role: event.sender.role },
            groupId: event.subType === 'group' ? String((event as any).groupId || '') : undefined,
          });
        }
        if ((event as any).groupId) {
          await store.upsertGroup({
            platform,
            botId,
            group: { id: String((event as any).groupId), name: String((event as any).groupId) },
          });
        }
      }
    } catch (cacheErr) {
      console.warn('[Webhook] cache contacts/groups failed', cacheErr);
    }

    // 10. 处理事件
    const results = await flowProcessor.process(event, bot);
    console.info('[Webhook] Event processed', {
      eventId: event.id,
      eventType: event.type,
      flowResults: results.map(r => ({ flowId: r.flowId, matched: r.matched, executed: r.executed, duration: r.duration }))
    });

    try {
      await appendEventLog(platform, botId, {
        id: event.id,
        type: event.type,
        subType: (event as any).subType,
        platform,
        botId,
        timestamp: Date.now(),
        sender: { userId: (event as any)?.sender?.userId },
        summary: {
          flowResults: results.map(r => ({ flowId: r.flowId, matched: r.matched, executed: r.executed, duration: r.duration, error: r.error })),
        },
      });
    } catch (e) {
      console.warn('[Webhook] appendEventLog failed', e);
    }

    // 11. 记录执行结果（可选：存储到日志）
    console.log(`Event processed for bot ${botId}:`, {
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
    return new NextResponse(JSON.stringify(webhookResponse.body), {
      status: webhookResponse.status,
      headers: {
        'Content-Type': 'application/json',
        ...webhookResponse.headers,
      },
    });
  } catch (error) {
    console.error(`Webhook error for ${platform}/${botId}:`, error);
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

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      query[key] = value;
    });

    // 返回验证响应
    // 具体的验证逻辑由各 Adapter 实现
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
