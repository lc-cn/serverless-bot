import { NextRequest, NextResponse } from 'next/server';
import { adapterRegistry, flowProcessor } from '@/core';
import { getBot, getFlows, getJobs } from '@/lib/data';
import { type NoticeEvent } from '@/types';
import { getChatStore, type ContactRecord } from '@/lib/chat-store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const botId = searchParams.get('bot_id');
    const groupId = searchParams.get('group_id') || undefined;

    if (!platform || !botId) {
      return NextResponse.json({ error: 'platform and bot_id required' }, { status: 400 });
    }

    const store = getChatStore();

    // 优先调用适配器获取实时联系人（如果提供 group_id 则取群成员）
    try {
      const adapter = adapterRegistry.get(platform);
      const botConfig = await getBot(botId);
      if (adapter && botConfig && botConfig.enabled) {
        const bot = adapter.getOrCreateBot(botConfig);
        const users = await bot.getUserList(groupId);
        if (users && users.length > 0) {
          const contacts: ContactRecord[] = users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
          // 缓存一份，避免频繁请求并写入 DB
          for (const c of contacts) {
            await store.upsertContact({ platform, botId, contact: c, groupId });
          }
          return NextResponse.json({ contacts });
        }
      }
    } catch (err) {
      console.warn('Failed to load contacts from adapter, fallback to cache', err);
    }

    // 回退到存储（PG 优先，KV 兜底）
    const contacts = await store.listContacts({ platform, botId, groupId: groupId || undefined });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Failed to get contacts', error);
    return NextResponse.json({ error: 'Failed to get contacts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, bot_id: botId, contact, group_id: groupId } = body as { platform?: string; bot_id?: string; contact?: ContactRecord; group_id?: string };

    if (!platform || !botId || !contact || !contact.id || !contact.name) {
      return NextResponse.json({ error: 'platform, bot_id and contact{id,name} required' }, { status: 400 });
    }

    const store = getChatStore();
    await store.upsertContact({ platform, botId, contact, groupId: groupId || undefined });

    // Trigger flow for contact added (custom notice)
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
          extra: { contact },
        };
        const flows = await getFlows();
        const jobs = await getJobs();
        flowProcessor.setFlows(flows);
        flowProcessor.setJobs(jobs);
        await flowProcessor.process(event as any, bot);
      }
    } catch (e) {
      console.warn('Flow processing failed in contacts POST:', e);
    }

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error('Failed to add contact', error);
    return NextResponse.json({ error: 'Failed to add contact' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, bot_id: botId, id } = body as { platform?: string; bot_id?: string; id?: string };

    if (!platform || !botId || !id) {
      return NextResponse.json({ error: 'platform, bot_id and id required' }, { status: 400 });
    }

    const store = getChatStore();
    await store.deleteContact({ platform, botId, id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete contact', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
