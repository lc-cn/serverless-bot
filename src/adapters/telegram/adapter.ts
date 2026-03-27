import { z } from 'zod';
import { Adapter, FormUISchema, AdapterFeature } from '@/core/adapter';
import type { AdapterSetupGuideDefinition } from '@/core/adapter-setup-guide';
import { TelegramBot } from './bot';
import {
  BotConfig,
  BotEvent,
  MessageEvent,
  Message,
  UserRole,
} from '@/types';
import { generateId } from '@/lib/shared/utils';

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

  getSetupGuide(): AdapterSetupGuideDefinition | null {
    return {
      namespace: 'telegram',
      sectionTitleKey: 'getTokenTitle',
      steps: [
        { titleKey: 'step1Title', border: 'blue', body: { kind: 'rich', messageKey: 'step1Body' } },
        { titleKey: 'step2Title', border: 'blue', body: { kind: 'rich', messageKey: 'step2Body' } },
        { titleKey: 'step3Title', border: 'blue', body: { kind: 'rich', messageKey: 'step3Body' } },
        { titleKey: 'step4Title', border: 'green', body: { kind: 'rich', messageKey: 'step4Body' } },
      ],
      tipKey: 'tip',
      usage: {
        lines: [
          { kind: 'lead', key: 'usage1' },
          { kind: 'lead', key: 'usage2' },
          { kind: 'lead', key: 'usage3' },
          { kind: 'lead', key: 'usage4' },
          { kind: 'lead', key: 'usage5' },
          { kind: 'lead', key: 'usage6' },
        ],
      },
    };
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

    if (update.message) {
      return this.parseMessageEvent(botId, update.message);
    }
    if (update.edited_message) {
      return this.parseMessageEvent(botId, update.edited_message);
    }
    if (update.channel_post) {
      return this.parseMessageEvent(botId, update.channel_post);
    }
    if (update.callback_query) {
      return this.parseCallbackQueryAsMessage(botId, update.callback_query);
    }

    // inline_query、chat_join_request 等暂不映射为 BotEvent；需要时可扩展为 notice/request
    return null;
  }

  /**
   * 内联键盘按钮：映射为 message 事件，rawContent / 文本为 callback `data`，便于触发器按关键词匹配。
   * 无 `message` 上下文（纯 inline_message_id）时不生成事件。
   */
  private parseCallbackQueryAsMessage(botId: string, cq: TelegramCallbackQuery): MessageEvent | null {
    const msg = cq.message;
    if (!msg) return null;

    const data = cq.data ?? '';
    const isGroup =
      msg.chat.type === 'group' ||
      msg.chat.type === 'supergroup' ||
      msg.chat.type === 'channel';
    const role: UserRole = 'normal';

    return {
      id: generateId(),
      type: 'message',
      subType: isGroup ? 'group' : 'private',
      platform: 'telegram',
      botId,
      timestamp: Date.now(),
      sender: {
        userId: String(cq.from?.id ?? msg.from?.id ?? 0),
        nickname: cq.from?.first_name || msg.from?.first_name || 'Unknown',
        role,
      },
      content: data ? [{ type: 'text', data: { text: data } }] : [],
      rawContent: data,
      groupId: isGroup ? String(msg.chat.id) : undefined,
      messageId: `cb:${String(cq.id)}`,
      raw: { callback_query: cq, message: msg },
    };
  }

  private parseMessageEvent(botId: string, message: TelegramMessage): MessageEvent {
    const isGroup =
      message.chat.type === 'group' ||
      message.chat.type === 'supergroup' ||
      message.chat.type === 'channel';

    const content: Message = [];
    const rawTextParts: string[] = [];

    if (message.reply_to_message?.message_id != null) {
      content.push({
        type: 'reply',
        data: { messageId: String(message.reply_to_message.message_id) },
      });
    }

    if (message.text) {
      content.push({ type: 'text', data: { text: message.text } });
      rawTextParts.push(message.text);
    }
    if (message.caption) {
      content.push({ type: 'text', data: { text: message.caption } });
      rawTextParts.push(message.caption);
    }

    if (message.photo?.length) {
      const largestPhoto = message.photo[message.photo.length - 1];
      content.push({
        type: 'image',
        data: { url: '', file: largestPhoto.file_id },
      });
      if (!message.caption && !message.text) rawTextParts.push('[图片]');
    }

    if (message.document) {
      content.push({
        type: 'file',
        data: {
          file_id: message.document.file_id,
          file_name: message.document.file_name,
          mime_type: message.document.mime_type,
        },
      });
      if (!message.text && !message.caption) {
        rawTextParts.push(`[文件:${message.document.file_name || message.document.file_id}]`);
      }
    }
    if (message.voice) {
      content.push({
        type: 'audio',
        data: { file_id: message.voice.file_id, duration: message.voice.duration },
      });
      if (!message.text && !message.caption) rawTextParts.push('[语音]');
    }
    if (message.audio) {
      content.push({
        type: 'audio',
        data: {
          file_id: message.audio.file_id,
          duration: message.audio.duration,
          title: message.audio.title,
          performer: message.audio.performer,
        },
      });
      if (!message.text && !message.caption) rawTextParts.push('[音频]');
    }
    if (message.video) {
      content.push({
        type: 'video',
        data: { file_id: message.video.file_id, duration: message.video.duration },
      });
      if (!message.text && !message.caption) rawTextParts.push('[视频]');
    }
    if (message.video_note) {
      content.push({
        type: 'video',
        data: {
          file_id: message.video_note.file_id,
          kind: 'video_note',
          duration: message.video_note.duration,
        },
      });
      if (!message.text && !message.caption) rawTextParts.push('[视频消息]');
    }
    if (message.sticker) {
      content.push({
        type: 'face',
        data: {
          file_id: message.sticker.file_id,
          emoji: message.sticker.emoji,
          set_name: message.sticker.set_name,
        },
      });
      if (!message.text && !message.caption) {
        rawTextParts.push(message.sticker.emoji ? `[贴纸${message.sticker.emoji}]` : '[贴纸]');
      }
    }

    const role: UserRole = 'normal';
    const from = message.from ?? message.sender_chat;
    let displayName = 'Unknown';
    if (from) {
      if ('first_name' in from && from.first_name) {
        displayName = from.first_name;
      } else if ('title' in from && from.title) {
        displayName = from.title;
      }
    }

    return {
      id: generateId(),
      type: 'message',
      subType: isGroup ? 'group' : 'private',
      platform: 'telegram',
      botId,
      timestamp: message.date * 1000,
      sender: {
        userId: String(from?.id || 0),
        nickname: displayName,
        role,
      },
      content,
      rawContent: rawTextParts.join('\n').trim(),
      groupId: isGroup ? String(message.chat.id) : undefined,
      messageId: String(message.message_id),
      raw: message,
    };
  }

  async verifyWebhook(
    rawData: unknown,
    headers: Record<string, string>,
    config: Record<string, unknown>,
    _query?: Record<string, string>
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
    return ['message', 'group', 'user', 'file'];
  }
}

// ==================== Telegram 类型定义 ====================

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  inline_query?: unknown;
}

interface TelegramCallbackQuery {
  id: string | number;
  from?: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  /** 频道消息等场景下可能只有 sender_chat */
  sender_chat?: TelegramChat;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  voice?: TelegramVoice;
  audio?: TelegramAudio;
  video?: TelegramVideo;
  video_note?: TelegramVideoNote;
  sticker?: TelegramSticker;
  reply_to_message?: TelegramMessage;
}

interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
}

interface TelegramVoice {
  file_id: string;
  duration: number;
}

interface TelegramAudio {
  file_id: string;
  duration: number;
  performer?: string;
  title?: string;
}

interface TelegramVideo {
  file_id: string;
  duration: number;
}

interface TelegramVideoNote {
  file_id: string;
  duration: number;
}

interface TelegramSticker {
  file_id: string;
  emoji?: string;
  set_name?: string;
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
