import type { FlowAction } from '@/types';
import type { MessageEvent, RequestEvent } from '@/types';
import type { JobContext } from '../types';
import { interpolate } from '../step-template';

export async function executeHandleRequest(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    approve: boolean;
    remark?: string;
    reason?: string;
  };

  if (context.event.type !== 'request') {
    throw new Error('Can only handle request events');
  }

  const reqEvent = context.event as RequestEvent;
  let success = false;

  if (reqEvent.subType === 'friend') {
    const remark = config.remark ? interpolate(config.remark, context) : undefined;
    success = await context.bot.handleFriendRequest(reqEvent.flag, config.approve, remark);
  } else if (reqEvent.subType === 'group_invite' || reqEvent.subType === 'group_join') {
    const reason = config.reason ? interpolate(config.reason, context) : undefined;
    success = await context.bot.handleGroupRequest(reqEvent.flag, config.approve, reason);
  }

  return { type: 'handle_request', success, approved: config.approve };
}

export async function executeRecallMessage(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    messageId?: string;
  };

  let messageId = config.messageId ? interpolate(config.messageId, context) : undefined;

  if (!messageId && context.event.type === 'message') {
    messageId = (context.event as MessageEvent).messageId;
  }

  if (!messageId) {
    throw new Error('Message ID not found');
  }

  const success = await context.bot.recallMessage(messageId);

  return { type: 'recall_message', success, messageId };
}
