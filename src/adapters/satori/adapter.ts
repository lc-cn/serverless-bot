import { z } from 'zod';
import { Adapter, FormUISchema, AdapterFeature } from '@/core/adapter';
import type { AdapterSetupGuideDefinition } from '@/core/adapter-setup-guide';
import { SatoriBot } from './bot';
import type { BotConfig, BotEvent, MessageEvent, UserRole } from '@/types';
import { generateId } from '@/lib/shared/utils';

function headerGet(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

/** Satori WebHook EVENT body（节选） @see https://satori.chat/zh-CN/protocol/events.html */
interface SatoriWebhookEvent {
  sn?: number;
  type?: string;
  timestamp?: number;
  login?: { platform?: string; user?: { id?: string } };
  channel?: { id?: string; type?: number | string; name?: string };
  guild?: { id?: string; name?: string };
  message?: {
    id?: string;
    content?: string;
    channel?: { id?: string; type?: number | string };
    user?: { id?: string; name?: string; nick?: string };
    created_at?: number;
  };
  user?: { id?: string; name?: string; nick?: string };
  member?: { user?: { id?: string; name?: string; nick?: string } };
  argv?: { name?: string; arguments?: unknown[]; options?: Record<string, unknown> };
  button?: { id?: string };
}

function channelIsDirect(ch: { type?: number | string } | undefined): boolean {
  if (ch == null) return false;
  const t = ch.type;
  return t === 1 || t === 'DIRECT';
}

/** Satori ChannelType: TEXT=0, DIRECT=1 */
export class SatoriAdapter extends Adapter {
  constructor() {
    super(
      'satori',
      'Satori',
      'Satori 通用协议：HTTP Webhook 收事件 + /v1 HTTP API 发消息（需配合 Satori SDK / 桥）',
      '💠',
    );
  }

  getAdapterConfigSchema(): z.ZodSchema {
    return z.object({});
  }

  getBotConfigSchema(): z.ZodSchema {
    return z.object({
      apiBaseUrl: z.string().min(1, 'SDK HTTP 根地址不能为空'),
      apiToken: z.string().optional(),
      satoriPlatform: z.string().min(1, 'Satori-Platform 不能为空'),
      satoriUserId: z.string().min(1, 'Satori-User-ID（机器人平台账号 ID）不能为空'),
      webhookSecret: z.string().optional(),
    });
  }

  getBotConfigUISchema(): FormUISchema {
    return {
      fields: [
        {
          name: 'apiBaseUrl',
          label: 'SDK HTTP 根地址',
          type: 'text',
          required: true,
          placeholder: 'http://127.0.0.1:5140',
          description: 'Satori SDK 提供的 HTTP API 根 URL，无尾斜杠。例如 Koishi / chronocat 等监听地址。',
        },
        {
          name: 'apiToken',
          label: 'API Token（可选）',
          type: 'password',
          required: false,
          placeholder: '与 SDK 中鉴权配置一致',
          description: '调用 /v1/*.create 时作为 Authorization: Bearer；与 Webhook 反向鉴权可以不同。',
        },
        {
          name: 'satoriPlatform',
          label: 'Satori-Platform',
          type: 'text',
          required: true,
          placeholder: 'qq、discord、telegram…',
          description: '与当前登录一致的平台标识，写入 API 请求头 Satori-Platform。',
        },
        {
          name: 'satoriUserId',
          label: 'Satori-User-ID',
          type: 'text',
          required: true,
          placeholder: '机器人该平台用户 ID',
          description: '当前机器人账号在对应平台上的用户 ID，写入请求头 Satori-User-ID。',
        },
        {
          name: 'webhookSecret',
          label: 'Webhook 密钥（可选）',
          type: 'password',
          required: false,
          placeholder: 'SDK 侧填写的 Bearer token',
          description:
            '若配置：入站 Webhook 须带 Authorization: Bearer 且与本字段一致（Satori 反向鉴权）。',
        },
      ],
    };
  }

  getSetupGuide(): AdapterSetupGuideDefinition | null {
    return {
      namespace: 'satori',
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
          { kind: 'field', key: 'usageFieldApi' },
          { kind: 'field', key: 'usageFieldPlatform' },
          { kind: 'field', key: 'usageFieldUserId' },
          { kind: 'field', key: 'usageFieldToken' },
          { kind: 'field', key: 'usageFieldSecret' },
          { kind: 'lead', key: 'usage3' },
          { kind: 'lead', key: 'usage4' },
        ],
      },
    };
  }

  createBot(config: BotConfig): SatoriBot {
    return new SatoriBot(config);
  }

  async parseEvent(botId: string, rawData: unknown, headers: Record<string, string>): Promise<BotEvent | null> {
    const op = headerGet(headers, 'satori-opcode');
    if (op != null && op !== '0') {
      return null;
    }

    const ev = rawData as SatoriWebhookEvent;
    const ty = ev.type;

    if (ty === 'interaction/command') {
      return this.parseSatoriSlash(botId, ev);
    }
    if (ty === 'interaction/button') {
      return this.parseSatoriButton(botId, ev);
    }

    if (ty === 'message-created' || ty === 'message-updated' || ty === 'message-deleted') {
      return this.buildSatoriMessageEvent(botId, ev, { deleted: ty === 'message-deleted' });
    }

    return null;
  }

  private parseSatoriSlash(botId: string, ev: SatoriWebhookEvent): MessageEvent | null {
    const argv = ev.argv;
    const name = argv?.name?.trim();
    const ch = ev.channel ?? ev.message?.channel;
    if (!name || !ch?.id) return null;

    const user = ev.user ?? ev.member?.user ?? ev.message?.user;
    if (!user?.id) return null;

    const isDm = channelIsDirect(ch);
    const args = Array.isArray(argv?.arguments) ? argv.arguments.map(String).join(' ') : '';
    const rawContent = (`/${name}${args ? ` ${args}` : ''}`).trim();
    const ts = (ev.timestamp ?? Date.now()) as number;
    const nick = user.nick || user.name;

    return {
      id: generateId(),
      type: 'message',
      subType: isDm ? 'private' : 'group',
      platform: 'satori',
      botId,
      timestamp: ts,
      sender: {
        userId: String(user.id),
        nickname: nick,
        role: 'normal' as UserRole,
      },
      content: [{ type: 'text', data: { text: rawContent } }],
      rawContent,
      groupId: isDm ? undefined : String(ch.id),
      messageId: String(ev.message?.id || generateId()),
      raw: {
        ...ev,
        __satori: { channelId: String(ch.id), platform: ev.login?.platform },
      },
    };
  }

  private parseSatoriButton(botId: string, ev: SatoriWebhookEvent): MessageEvent | null {
    const bid = ev.button?.id;
    const ch = ev.channel ?? ev.message?.channel;
    if (bid == null || bid === '' || !ch?.id) return null;

    const user = ev.user ?? ev.member?.user ?? ev.message?.user;
    if (!user?.id) return null;

    const isDm = channelIsDirect(ch);
    const ts = (ev.timestamp ?? Date.now()) as number;
    const nick = user.nick || user.name;

    return {
      id: generateId(),
      type: 'message',
      subType: isDm ? 'private' : 'group',
      platform: 'satori',
      botId,
      timestamp: ts,
      sender: {
        userId: String(user.id),
        nickname: nick,
        role: 'normal' as UserRole,
      },
      content: [{ type: 'text', data: { text: bid } }],
      rawContent: bid,
      groupId: isDm ? undefined : String(ch.id),
      messageId: String(ev.message?.id || generateId()),
      raw: {
        ...ev,
        __satori: { channelId: String(ch.id), platform: ev.login?.platform },
      },
    };
  }

  private buildSatoriMessageEvent(
    botId: string,
    ev: SatoriWebhookEvent,
    opts: { deleted?: boolean },
  ): MessageEvent | null {
    const msg = ev.message;
    if (!msg?.id) return null;

    const ch = ev.channel ?? msg.channel;
    if (!ch?.id) return null;

    const user = ev.user ?? msg.user;
    if (!user?.id) return null;

    const isDm = channelIsDirect(ch);
    const text = typeof msg.content === 'string' ? msg.content : '';
    const ts = (ev.timestamp ?? msg.created_at ?? Date.now()) as number;
    const nick = user.nick || user.name;
    const deleted = !!opts.deleted;
    const rawContent = deleted ? '[message-deleted]' : text;

    return {
      id: generateId(),
      type: 'message',
      subType: isDm ? 'private' : 'group',
      platform: 'satori',
      botId,
      timestamp: ts,
      sender: {
        userId: String(user.id),
        nickname: nick,
        role: 'normal',
      },
      content: deleted || !text ? [] : [{ type: 'text', data: { text } }],
      rawContent,
      groupId: isDm ? undefined : String(ch.id),
      messageId: String(msg.id),
      raw: {
        ...ev,
        __satori: {
          channelId: String(ch.id),
          platform: ev.login?.platform,
        },
      },
    };
  }

  async verifyWebhook(
    _rawData: unknown,
    headers: Record<string, string>,
    config: Record<string, unknown>,
    _query?: Record<string, string>
  ): Promise<boolean> {
    const secret = (config.webhookSecret as string | undefined)?.trim();
    if (!secret) return true;
    const auth = headerGet(headers, 'authorization');
    const token = auth?.replace(/^Bearer\s+/i, '').trim();
    return token === secret;
  }

  getSupportedFeatures(): AdapterFeature[] {
    return ['message', 'group', 'user'];
  }
}
