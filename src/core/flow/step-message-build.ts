import type { Message } from '@/types';
import { MessageBuilder } from './message-builder';
import type { JobContext } from './types';
import { interpolate } from './step-template';

/** 构建消息：text / template / segments */
export function buildMessage(
  config: {
    messageType?: 'text' | 'template' | 'segments';
    content?: string;
    template?: string;
    text?: string;
    segments?: Array<{
      type: 'text' | 'image' | 'at' | 'reply';
      data: Record<string, string>;
    }>;
  },
  context: JobContext
): Message {
  const messageType = config.messageType || 'text';

  switch (messageType) {
    case 'template': {
      const templateStr = config.template || config.content || config.text || '';
      const interpolated = interpolate(templateStr, context);
      return MessageBuilder.parse(interpolated, context.variables);
    }

    case 'segments': {
      if (!config.segments || config.segments.length === 0) {
        return [{ type: 'text', data: { text: '' } }];
      }
      return config.segments.map((seg) => ({
        type: seg.type,
        data: Object.fromEntries(
          Object.entries(seg.data).map(([k, v]) => [k, interpolate(v, context)])
        ),
      })) as Message;
    }

    case 'text':
    default: {
      const text = config.content || config.text || config.template || '';
      const interpolated = interpolate(text, context);
      return [{ type: 'text', data: { text: interpolated } }];
    }
  }
}
