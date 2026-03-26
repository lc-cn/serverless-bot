import { NextRequest, NextResponse } from 'next/server';
import { adapterRegistry, flowProcessor } from '@/core';
import { getBot } from '@/lib/persistence';
import { storage } from '@/lib/persistence';
import { type NoticeEvent } from '@/types';
import { getChatStore, type GroupRecord } from '@/lib/persistence';
import { apiRequireBotAccess } from '@/lib/auth/permissions';
import { getOrCreateTraceId } from '@/lib/runtime/request-trace';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const botId = searchParams.get('bot_id');

    if (!platform || !botId) {
      return NextResponse.json({ error: 'platform and bot_id required' }, { status: 400 });
    }

    const gate = await apiRequireBotAccess(botId, 'read');
    if (gate.error) return gate.error;

    const store = getChatStore();
    // Telegram 无法列出所有群，先尝试读取缓存/存储；如未来平台支持可在此调用 adapter.getGroupList()
    const groups = await store.listGroups({ platform, botId });
    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Failed to get groups', error);
    return NextResponse.json({ error: 'Failed to get groups' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const traceId = getOrCreateTraceId(req.headers);
    const body = await req.json();
    const { platform, bot_id: botId, group } = body as { platform?: string; bot_id?: string; group?: GroupRecord };

    if (!platform || !botId || !group || !group.id || !group.name) {
      return NextResponse.json({ error: 'platform, bot_id and group{id,name} required' }, { status: 400 });
    }

    const gate = await apiRequireBotAccess(String(botId), 'write');
    if (gate.error) return gate.error;

    const store = getChatStore();
    await store.upsertGroup({ platform, botId, group });

    // Trigger flow for group added (custom notice)
    try {
      const adapter = adapterRegistry.get(platform);
      const botConfig = await getBot(botId);
      if (adapter && botConfig && botConfig.enabled) {
        const bot = adapter.getOrCreateBot(botConfig);
        const event: NoticeEvent = {
          id: `${Date.now()}`,
          type: 'notice',
          subType: 'custom',
          platform: platform,
          botId: botId,
          timestamp: Date.now(),
          sender: { userId: 'web', role: 'normal' },
          extra: { group },
        };
        const owner = botConfig.ownerId ?? null;
        const { flows, jobs, triggers } = await storage.getWebhookFlowRuntimeSnapshot(owner);
        await flowProcessor.process(event as any, bot, { flows, jobs, triggers }, { traceId });
      }
    } catch (e) {
      console.warn(`[trace:${traceId}] Flow processing failed in groups POST:`, e);
    }

    return NextResponse.json({ success: true, group });
  } catch (error) {
    console.error('Failed to add group', error);
    return NextResponse.json({ error: 'Failed to add group' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, bot_id: botId, id } = body as { platform?: string; bot_id?: string; id?: string };

    if (!platform || !botId || !id) {
      return NextResponse.json({ error: 'platform, bot_id and id required' }, { status: 400 });
    }

    const gate = await apiRequireBotAccess(String(botId), 'write');
    if (gate.error) return gate.error;

    const store = getChatStore();
    await store.deleteGroup({ platform, botId, id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete group', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
