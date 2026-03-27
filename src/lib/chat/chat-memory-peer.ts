import type { BotEvent, MessageEvent } from '@/types';
import type { PeerType } from '@/lib/persistence/chat-store';

export type ChatMemoryPeer = {
  platform: string;
  botId: string;
  peerType: PeerType;
  peerId: string;
};

/**
 * 解析 ChatStore 会话维度：私聊用对端用户 id，群聊用群 id。
 * 控制台通过 /api/chat/send 触发时，私聊事件需将 sender.userId 设为 peer_id，否则无法对齐已存消息。
 */
export function resolveChatMemoryPeer(event: BotEvent): ChatMemoryPeer | null {
  if (event.type !== 'message') return null;
  const me = event as MessageEvent;
  if (me.subType === 'group') {
    const gid = me.groupId;
    if (!gid || !String(gid).trim()) return null;
    return { platform: me.platform, botId: me.botId, peerType: 'group', peerId: String(gid) };
  }
  const uid = me.sender?.userId;
  if (!uid || uid === 'web') return null;
  return { platform: me.platform, botId: me.botId, peerType: 'contact', peerId: String(uid) };
}

export function messageTextFromMessageEvent(me: MessageEvent): string {
  const raw = String(me.rawContent ?? '').trim();
  if (raw) return String(me.rawContent ?? '');
  const parts: string[] = [];
  for (const seg of me.content || []) {
    if (seg.type === 'text' && seg.data && typeof (seg.data as { text?: string }).text === 'string') {
      parts.push((seg.data as { text: string }).text);
    }
  }
  return parts.join('\n').trim();
}
