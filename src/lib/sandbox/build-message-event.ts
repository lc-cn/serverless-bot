import type { MessageEvent, UserRole } from '@/types';
import { generateId } from '@/lib/shared/utils';
import { z } from 'zod';

const userRoleSchema = z.enum(['normal', 'admin', 'owner']);

export type SandboxChatMessageInput = {
  text: string;
  subType?: 'private' | 'group';
  groupId?: string;
  senderUserId?: string;
  senderNickname?: string;
  senderRole?: UserRole;
};

function messageFromShorthand(botId: string, obj: Record<string, unknown>): MessageEvent {
  const text = typeof obj.text === 'string' ? obj.text : '';
  const subType = obj.subType === 'group' ? 'group' : 'private';
  const userId = typeof obj.senderUserId === 'string' ? obj.senderUserId : 'sandbox_user';
  const nickname = typeof obj.senderNickname === 'string' ? obj.senderNickname : 'Chat user';
  const roleParsed = userRoleSchema.safeParse(obj.senderRole);
  const role: UserRole = roleParsed.success ? roleParsed.data : 'normal';
  const groupId = typeof obj.groupId === 'string' ? obj.groupId : undefined;
  const messageId = typeof obj.messageId === 'string' ? obj.messageId : generateId();

  return {
    id: typeof obj.eventId === 'string' ? obj.eventId : generateId(),
    type: 'message',
    subType,
    platform: 'sandbox',
    botId,
    timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : Date.now(),
    sender: { userId, nickname, role },
    content: [{ type: 'text', data: { text } }],
    rawContent: text,
    messageId,
    groupId: subType === 'group' ? groupId : undefined,
    raw: obj,
  };
}

export function buildSandboxChatMessageEvent(
  botId: string,
  input: SandboxChatMessageInput
): MessageEvent {
  return messageFromShorthand(botId, input as unknown as Record<string, unknown>);
}
