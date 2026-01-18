import { z } from 'zod';
import { Adapter, FormUISchema, AdapterFeature } from '@/core/adapter';
import { TelegramBot } from './bot';
import {
  BotConfig,
  BotEvent,
  MessageEvent,
  Message,
  UserRole,
} from '@/types';
import { generateId } from '@/lib/utils';

/**
 * Telegram 适配器
 */
export class TelegramAdapter extends Adapter {
  constructor() {
    super(
      'telegram',
      'Telegram',
      'Telegram Bot API 适配器',
      '📱'
    );
  }

  // ==================== Schema 定义 ====================

  getAdapterConfigSchema(): z.ZodSchema {
    return z.object({
      // Telegram 适配器级别配置（如有需要）
    });
  }

  getBotConfigSchema(): z.ZodSchema {
    return z.object({
      accessToken: z.string().min(1, 'Access Token 不能为空'),
      secret: z.string().optional(),
    });
  }

  getAdapterConfigUISchema(): FormUISchema {
    return { fields: [] };
  }

  getBotConfigUISchema(): FormUISchema {
    return {
      fields: [
        {
          name: 'accessToken',
          label: 'Bot Token',
          type: 'password',
          required: true,
          placeholder: '从 @BotFather 获取的 Token',
          description: '格式: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        },
        {
          name: 'secret',
          label: 'Webhook Secret',
          type: 'password',
          required: false,
          placeholder: '用于验证 Webhook 请求',
          description: '可选，设置后将验证 X-Telegram-Bot-Api-Secret-Token 头',
        },
      ],
    };
  }

  // ==================== Bot 管理 ====================

  createBot(config: BotConfig): TelegramBot {
    return new TelegramBot(config);
  }

  // ==================== 事件处理 ====================

  async parseEvent(
    botId: string,
    rawData: unknown,
    headers: Record<string, string>
  ): Promise<BotEvent | null> {
    const update = rawData as TelegramUpdate;

    // 处理消息事件
    if (update.message) {
      return this.parseMessageEvent(botId, update.message);
    }

    // TODO: 处理其他类型的事件
    // - callback_query
    // - inline_query
    // - etc.

    return null;
  }

  private parseMessageEvent(botId: string, message: TelegramMessage): MessageEvent {
    const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';

    // 解析消息内容
    const content: Message = [];
    
    if (message.text) {
      content.push({ type: 'text', data: { text: message.text } });
    }

    if (message.photo) {
      const largestPhoto = message.photo[message.photo.length - 1];
      content.push({
        type: 'image',
        data: { file: largestPhoto.file_id },
      });
    }

    // 确定用户角色（需要额外 API 调用，这里简化处理）
    let role: UserRole = 'normal';

    return {
      id: generateId(),
      type: 'message',
      subType: isGroup ? 'group' : 'private',
      platform: 'telegram',
      botId,
      timestamp: message.date * 1000,
      sender: {
        userId: String(message.from?.id || 0),
        nickname: message.from?.first_name || 'Unknown',
        role,
      },
      content,
      rawContent: message.text || '',
      groupId: isGroup ? String(message.chat.id) : undefined,
      messageId: String(message.message_id),
      raw: message,
    };
  }

  async verifyWebhook(
    rawData: unknown,
    headers: Record<string, string>,
    config: Record<string, unknown>
  ): Promise<boolean> {
    const secret = config.secret as string | undefined;
    
    if (!secret) {
      // 未配置 secret，跳过验证
      return true;
    }

    const providedSecret = headers['x-telegram-bot-api-secret-token'];
    return providedSecret === secret;
  }

  getSupportedFeatures(): AdapterFeature[] {
    return ['message', 'group', 'user'];
  }
}

// ==================== Telegram 类型定义 ====================

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: unknown;
  inline_query?: unknown;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  reply_to_message?: TelegramMessage;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}
