import type { FlowAction, MessageEvent } from '@/types';
import type { JobContext } from '../types';
import { buildMessage } from '../step-message-build';
import { interpolate } from '../step-template';

export async function executeSendMessage(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    messageType?: 'text' | 'template' | 'segments';
    content?: string;
    text?: string;
    template?: string;
    segments?: Array<{
      type: 'text' | 'image' | 'at' | 'reply';
      data: Record<string, string>;
    }>;
    target?: {
      type: 'private' | 'group';
      id: string;
    };
    replyToEvent?: boolean;
  };

  const message = buildMessage(config, context);

  let sendResult;
  if (config.target) {
    const targetId = interpolate(config.target.id, context);
    const target =
      config.target.type === 'group'
        ? { type: 'group' as const, groupId: targetId }
        : { type: 'private' as const, userId: targetId };
    sendResult = await context.bot.sendMessage(target, message);
  } else {
    sendResult = await context.bot.reply(context.event, message);
  }

  if (!sendResult.success) {
    throw new Error(sendResult.error || 'send_message failed');
  }

  return {
    type: 'send_message',
    message,
    sendResult,
  };
}

export async function executeHardcode(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    messageType?: 'text' | 'template' | 'segments';
    content?: string;
    text?: string;
    template?: string;
    segments?: Array<{
      type: 'text' | 'image' | 'at' | 'reply';
      data: Record<string, string>;
    }>;
  };

  const message = buildMessage(config, context);

  const sendResult = await context.bot.reply(context.event, message);
  if (!sendResult.success) {
    throw new Error(sendResult.error || 'hardcode reply failed');
  }

  return { type: 'hardcode', message, sendResult };
}

export async function executeRandomReply(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    replies: Array<{
      content?: string;
      text?: string;
      template?: string;
      messageType?: 'text' | 'template';
    } | string>;
    messageType?: 'text' | 'template';
    saveAs?: string;
  };

  if (!config.replies || config.replies.length === 0) {
    throw new Error('No replies configured');
  }

  const randomReplyConfig = config.replies[Math.floor(Math.random() * config.replies.length)];

  const replyConfig =
    typeof randomReplyConfig === 'string'
      ? { content: randomReplyConfig, messageType: config.messageType || 'text' }
      : {
          ...randomReplyConfig,
          messageType: randomReplyConfig.messageType || config.messageType || 'text',
        };

  if (config.saveAs) {
    const content = replyConfig.content || replyConfig.text || replyConfig.template || '';
    context.variables[config.saveAs] = content;
    return { type: 'random_reply_save', saved: config.saveAs };
  }

  const message = buildMessage(replyConfig, context);
  const sendResult = await context.bot.reply(context.event, message);
  if (!sendResult.success) {
    throw new Error(sendResult.error || 'random_reply send failed');
  }
  return { type: 'random_reply', message, sendResult };
}

export async function executeTemplateMessage(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    messageType?: 'text' | 'template' | 'segments';
    content?: string;
    text?: string;
    template?: string;
    segments?: Array<{
      type: 'text' | 'image' | 'at' | 'reply';
      data: Record<string, string>;
    }>;
    format?: 'plain' | 'markdown';
    saveAs?: string;
  };

  if (config.saveAs) {
    const content = config.template || config.content || config.text || '';
    const interpolated = interpolate(content, context);
    context.variables[config.saveAs] = interpolated;
    return { type: 'template_message_save', saved: config.saveAs };
  }

  const message = buildMessage(config, context);
  const sendResult = await context.bot.reply(context.event, message);
  if (!sendResult.success) {
    throw new Error(sendResult.error || 'template_message send failed');
  }
  return { type: 'template_message', message, sendResult };
}

export async function executeForwardMessage(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    targetType: 'private' | 'group';
    targetId: string;
    messageId?: string;
  };

  if (context.event.type !== 'message') {
    throw new Error('Can only forward message events');
  }

  const msgEvent = context.event as MessageEvent;
  const targetId = interpolate(config.targetId, context);

  const sendResult = await context.bot.sendMessage(
    config.targetType === 'group'
      ? { type: 'group', groupId: targetId }
      : { type: 'private', userId: targetId },
    msgEvent.content
  );

  if (!sendResult.success) {
    throw new Error(sendResult.error || 'forward_message failed');
  }

  return { type: 'forward_message', sendResult };
}
