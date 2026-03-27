import { z } from 'zod';
import { Adapter, FormUISchema, AdapterFeature } from '@/core/adapter';
import type { AdapterSetupGuideDefinition } from '@/core/adapter-setup-guide';
import { OneBot11Bot } from './bot';
import {
  BotConfig,
  BotEvent,
  Message,
  MessageEvent,
  NoticeEvent,
  RequestEvent,
  NoticeEventSubType,
  RequestEventSubType,
  UserRole,
} from '@/types';
import { generateId } from '@/lib/shared/utils';

function headerGet(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/** OneBot 11 上报 JSON（post_type=message） */
interface OneBot11MessagePayload {
  time?: number;
  self_id?: number;
  post_type?: string;
  message_type?: string;
  notice_type?: string;
  request_type?: string;
  sub_type?: string;
  message_id?: number;
  user_id?: number;
  group_id?: number;
  operator_id?: number;
  target_id?: number;
  comment?: string;
  flag?: string;
  sender?: {
    user_id?: number;
    nickname?: string;
    role?: string;
    card?: string;
  };
  message?: unknown;
  raw_message?: string;
}

export class OneBot11Adapter extends Adapter {
  constructor() {
    super(
      'onebot11',
      'OneBot 11',
      'OneBot 11 兼容协议：HTTP 上报（Webhook）+ HTTP API 发信（NapCat / go-cqhttp 等）',
      '🤖',
    );
  }

  getAdapterConfigSchema(): z.ZodSchema {
    return z.object({});
  }

  getBotConfigSchema(): z.ZodSchema {
    return z.object({
      apiBaseUrl: z.string().min(1, 'HTTP API 根地址不能为空'),
      accessToken: z.string().optional(),
      webhookSecret: z.string().optional(),
    });
  }

  getBotConfigUISchema(): FormUISchema {
    return {
      fields: [
        {
          name: 'apiBaseUrl',
          label: 'HTTP API 根地址',
          type: 'text',
          required: true,
          placeholder: 'http://127.0.0.1:5700',
          description: '实现端开放的 API 根路径，无尾斜杠。用于 send_private_msg / send_group_msg。',
        },
        {
          name: 'accessToken',
          label: 'API Token（可选）',
          type: 'password',
          required: false,
          placeholder: '与实现端 access_token 一致',
          description: '若实现端启用 Token，将以此作为 Authorization: Bearer 调用 HTTP API。',
        },
        {
          name: 'webhookSecret',
          label: 'Webhook 密钥（可选）',
          type: 'password',
          required: false,
          placeholder: '与上报请求头一致',
          description:
            '若填写，则上报请求必须带请求头 X-OneBot-Secret，且值与此相同（可在 NapCat 等侧配置自定义上报头）。',
        },
      ],
    };
  }

  getSetupGuide(): AdapterSetupGuideDefinition | null {
    return {
      namespace: 'onebot11',
      sectionTitleKey: 'setupTitle',
      steps: [
        { titleKey: 'step1Title', border: 'indigo', body: { kind: 'rich', messageKey: 'step1Body' } },
        { titleKey: 'step2Title', border: 'indigo', body: { kind: 'rich', messageKey: 'step2Body' } },
        {
          titleKey: 'step3Title',
          border: 'green',
          body: {
            kind: 'paragraphAndCodeBlock',
            paragraphKey: 'step3Body',
            codeBlockMessageKey: 'step3ExampleUrl',
          },
        },
        { titleKey: 'step4Title', border: 'green', body: { kind: 'plain', messageKey: 'step4Body' } },
      ],
      tipKey: 'tip',
      usage: {
        lines: [
          { kind: 'lead', key: 'usage1' },
          { kind: 'lead', key: 'usage2' },
          { kind: 'lead', key: 'usage3' },
          { kind: 'field', key: 'usageFieldApi' },
          { kind: 'field', key: 'usageFieldToken' },
          { kind: 'field', key: 'usageFieldSecret' },
          { kind: 'lead', key: 'usage4' },
          { kind: 'lead', key: 'usage5' },
        ],
      },
    };
  }

  createBot(config: BotConfig): OneBot11Bot {
    return new OneBot11Bot(config);
  }

  async parseEvent(botId: string, rawData: unknown, _headers: Record<string, string>): Promise<BotEvent | null> {
    const p = rawData as OneBot11MessagePayload;
    if (p.post_type === 'meta_event') {
      return null;
    }
    if (p.post_type === 'notice') {
      return this.parseNoticeEvent(botId, p);
    }
    if (p.post_type === 'request') {
      return this.parseRequestEvent(botId, p);
    }
    if (p.post_type !== 'message') {
      return null;
    }
    const messageType = p.message_type;
    if (messageType !== 'private' && messageType !== 'group') {
      return null;
    }
    const subType: 'private' | 'group' = messageType === 'group' ? 'group' : 'private';
    const uid = p.user_id ?? p.sender?.user_id;
    if (uid == null) {
      return null;
    }
    const { content, rawText } = this.normalizeMessageContent(p.message, p.raw_message);
    const role = this.mapSenderRole(p.sender?.role);
    const ts = (p.time != null ? p.time * 1000 : Date.now()) as number;
    const messageId = p.message_id != null ? String(p.message_id) : generateId();

    return {
      id: generateId(),
      type: 'message',
      subType,
      platform: 'onebot11',
      botId,
      timestamp: ts,
      sender: {
        userId: String(uid),
        nickname: p.sender?.nickname || p.sender?.card,
        role,
      },
      content,
      rawContent: rawText,
      groupId: subType === 'group' && p.group_id != null ? String(p.group_id) : undefined,
      messageId,
      raw: p,
    } satisfies MessageEvent;
  }

  private mapNoticeSubType(noticeType?: string, subType?: string): NoticeEventSubType {
    switch (noticeType) {
      case 'group_increase':
        return 'group_member_increase';
      case 'group_decrease':
        return 'group_member_decrease';
      case 'group_admin':
        return 'group_admin_change';
      case 'group_ban':
      case 'group_unban':
        return 'group_ban';
      case 'friend_add':
        return 'friend_add';
      case 'notify':
        if (subType === 'poke') return 'poke';
        return 'custom';
      default:
        return 'custom';
    }
  }

  private parseNoticeEvent(botId: string, p: OneBot11MessagePayload): NoticeEvent | null {
    const uid = p.user_id ?? p.operator_id ?? p.self_id;
    if (uid == null) {
      return null;
    }
    const ts = (p.time != null ? p.time * 1000 : Date.now()) as number;
    const subType = this.mapNoticeSubType(p.notice_type, p.sub_type);
    return {
      id: generateId(),
      type: 'notice',
      subType,
      platform: 'onebot11',
      botId,
      timestamp: ts,
      sender: {
        userId: String(uid),
        nickname: p.sender?.nickname || p.sender?.card,
        role: this.mapSenderRole(p.sender?.role),
      },
      groupId: p.group_id != null ? String(p.group_id) : undefined,
      operatorId: p.operator_id != null ? String(p.operator_id) : undefined,
      targetId: p.target_id != null ? String(p.target_id) : undefined,
      extra: {
        notice_type: p.notice_type,
        sub_type: p.sub_type,
      },
      raw: p,
    } satisfies NoticeEvent;
  }

  private parseRequestEvent(botId: string, p: OneBot11MessagePayload): RequestEvent | null {
    const rt = p.request_type;
    if (rt !== 'friend' && rt !== 'group') {
      return null;
    }
    let subType: RequestEventSubType = 'friend';
    if (rt === 'group') {
      if (p.sub_type === 'add') subType = 'group_join';
      else subType = 'group_invite';
    }
    const uid = p.user_id;
    if (uid == null) {
      return null;
    }
    const ts = (p.time != null ? p.time * 1000 : Date.now()) as number;
    return {
      id: generateId(),
      type: 'request',
      subType,
      platform: 'onebot11',
      botId,
      timestamp: ts,
      sender: {
        userId: String(uid),
        nickname: p.sender?.nickname || p.sender?.card,
        role: this.mapSenderRole(p.sender?.role),
      },
      comment: p.comment,
      flag: String(p.flag ?? ''),
      groupId: p.group_id != null ? String(p.group_id) : undefined,
      raw: p,
    } satisfies RequestEvent;
  }

  private mapSenderRole(r?: string): UserRole {
    if (r === 'owner') return 'owner';
    if (r === 'admin' || r === 'administrator') return 'admin';
    return 'normal';
  }

  private normalizeMessageContent(message: unknown, rawFallback?: string): { content: Message; rawText: string } {
    if (Array.isArray(message)) {
      const content: Message = [];
      const textParts: string[] = [];
      for (const seg of message) {
        if (!seg || typeof seg !== 'object') continue;
        const s = seg as { type?: string; data?: Record<string, unknown> };
        const ty = s.type;
        const data = s.data || {};
        if (ty === 'text') {
          const text = String((data as { text?: string }).text ?? '');
          content.push({ type: 'text', data: { text } });
          textParts.push(text);
        } else if (ty === 'at') {
          const qq = (data as { qq?: string | number }).qq;
          content.push({
            type: 'at',
            data: { userId: qq != null ? String(qq) : '', name: (data as { name?: string }).name },
          });
          textParts.push(qq != null ? `@${qq}` : '');
        } else if (ty === 'image') {
          const file = (data as { file?: string; url?: string }).file || (data as { url?: string }).url;
          if (file) content.push({ type: 'image', data: { url: file } });
        }
      }
      const rawText = textParts.join('') || rawFallback || '';
      if (content.length === 0 && rawFallback) {
        return {
          content: [{ type: 'text', data: { text: rawFallback } }],
          rawText: rawFallback,
        };
      }
      return { content, rawText: rawText || rawFallback || '' };
    }
    if (typeof message === 'string') {
      return {
        content: [{ type: 'text', data: { text: message } }],
        rawText: message,
      };
    }
    const fallback = rawFallback || '';
    return {
      content: fallback ? [{ type: 'text', data: { text: fallback } }] : [],
      rawText: fallback,
    };
  }

  async verifyWebhook(
    _rawData: unknown,
    headers: Record<string, string>,
    config: Record<string, unknown>,
    _query?: Record<string, string>
  ): Promise<boolean> {
    const secret = config.webhookSecret as string | undefined;
    if (!secret) return true;
    const provided =
      headerGet(headers, 'x-onebot-secret') ||
      headerGet(headers, 'X-OneBot-Secret') ||
      headerGet(headers, 'authorization')?.replace(/^Bearer\s+/i, '');
    return provided === secret;
  }

  getSupportedFeatures(): AdapterFeature[] {
    return ['message', 'group', 'user', 'notice', 'request'];
  }
}
