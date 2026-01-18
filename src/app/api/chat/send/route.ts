import { NextRequest, NextResponse } from 'next/server';
import { adapterRegistry, flowProcessor } from '@/core';
import { storage } from '@/lib/unified-storage';
import { getChatStore, type ChatMessage, type PeerType } from '@/lib/chat-store';
import { type MessageEvent } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, bot_id: botId, text, peer_id: peerId, peer_type: peerType } = body;
    console.info('[ChatSend] Incoming', { platform, botId, peerId, peerType, textLen: String(text || '').length });

    if (!platform || !botId || !text) {
      return NextResponse.json({ error: 'platform, bot_id and text required' }, { status: 400 });
    }

    const store = getChatStore();
    const maxCount = peerType === 'group' ? 1000 : 500;
    const message: ChatMessage = {
      id: `${Date.now()}`,
      role: 'user',
      text: String(text),
      timestamp: Date.now(),
      peerId: peerId || undefined,
      peerType: (peerType as PeerType | undefined) || undefined,
    };

    await store.appendMessage({ platform, botId, peerId, peerType: (peerType as PeerType | null) ?? null, message, cap: maxCount });
    console.debug('[ChatSend] User message persisted');

    // 直接发送到目标会话（快速直发通道），不中断后续 Flow 触发
    if (peerId && peerType) {
      try {
        const adapter = adapterRegistry.get(platform);
        const botConfig = await storage.getBot(botId);
        if (adapter && botConfig && botConfig.enabled) {
          const bot = adapter.getOrCreateBot(botConfig);
          const target = peerType === 'group'
            ? { type: 'group' as const, groupId: peerId }
            : { type: 'private' as const, userId: peerId };
          const segments = [{ type: 'text', data: { text: String(text) } }] as MessageEvent['content'];
          const sendResult = await bot.sendMessage(target, segments);
          if (sendResult.success) {
            const botMessage: ChatMessage = {
              id: `${Date.now()}`,
              role: 'bot',
              text: String(text),
              timestamp: Date.now(),
              peerId: peerId || undefined,
              peerType: (peerType as PeerType | undefined) || undefined,
            };
            await store.appendMessage({ platform, botId, peerId, peerType: (peerType as PeerType | null) ?? null, message: botMessage, cap: maxCount });
            console.debug('[ChatSend] Direct send persisted');
          } else {
            console.warn('[ChatSend] Direct send failed', sendResult.error);
          }
        }
      } catch (directErr) {
        console.warn('[ChatSend] Direct send exception', directErr);
      }
    }

    // Trigger flows for a synthetic message event
    try {
      const adapter = adapterRegistry.get(platform);
      const botConfig = await storage.getBot(botId);
      if (adapter && botConfig && botConfig.enabled) {
        const bot = adapter.getOrCreateBot(botConfig);
        const event: MessageEvent = {
          id: `${Date.now()}`,
          type: 'message',
          subType: peerType === 'group' ? 'group' : 'private',
          platform,
          botId,
          timestamp: Date.now(),
          sender: { userId: 'web', role: 'normal' },
          content: [{ type: 'text', data: { text: String(text) } }],
          rawContent: String(text),
          messageId: message.id,
          groupId: peerType === 'group' ? peerId : undefined,
        };
        const flows = await storage.getFlows();
        const jobs = await storage.getJobs();
        flowProcessor.setFlows(flows);
        flowProcessor.setJobs(jobs);
        const flowResults = await flowProcessor.process(event, bot);
        console.info('[ChatSend] Flow processed', { count: flowResults.length });

        // Persist bot replies based on send_message action outputs
        try {
          for (const fr of flowResults) {
            for (const job of fr.jobs) {
              for (const step of job.steps) {
                const data: any = step.data;
                if (step.success && data && data.type === 'send_message' && typeof data.text === 'string') {
                  const botMessage: ChatMessage = {
                    id: `${Date.now()}`,
                    role: 'bot',
                    text: data.text,
                    timestamp: Date.now(),
                    peerId: peerId || undefined,
                    peerType: (peerType as PeerType | undefined) || undefined,
                  };
                  await store.appendMessage({ platform, botId, peerId, peerType: (peerType as PeerType | null) ?? null, message: botMessage, cap: maxCount });
                  console.debug('[ChatSend] Bot reply persisted');
                }
              }
            }
          }
        } catch (persistErr) {
          console.warn('Persisting bot replies failed:', persistErr);
        }
      }
    } catch (e) {
      console.warn('Flow processing failed in chat/send:', e);
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Failed to send message', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
