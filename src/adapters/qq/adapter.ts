import { z } from 'zod';
import { Adapter, FormUISchema, AdapterFeature, WebhookResponse } from '@/core/adapter';
import type { AdapterSetupGuideDefinition } from '@/core/adapter-setup-guide';
import { QQBot } from './bot';
import {
  BotConfig,
  BotEvent,
  Message,
  MessageEvent,
  NoticeEvent,
  NoticeEventSubType,
  UserRole,
} from '@/types';
import { generateId } from '@/lib/shared/utils';
import { QQEd25519 } from '@/lib/crypto/qq-ed25519';

/**
 * QQ 机器人适配器
 * 文档: https://bot.q.qq.com/wiki/develop/api-v2/
 * 
 * 支持场景：
 * - 单聊（C2C）
 * - 群聊（Group）
 * - 频道（Guild/Channel）
 * 
 * 鉴权方式：
 * - 使用 AppID + AppSecret 获取 Access Token
 * - Webhook 回调使用 Ed25519 签名验证
 */
export class QQAdapter extends Adapter {
  constructor() {
    super('qq', 'QQ', 'QQ 机器人 API v2 适配器', '🐧');
  }

  getAdapterConfigSchema(): z.ZodSchema {
    return z.object({});
  }

  getBotConfigSchema(): z.ZodSchema {
    return z.object({
      appId: z.string().min(1),
      appSecret: z.string().min(1),
    });
  }

  getAdapterConfigUISchema(): FormUISchema {
    return { fields: [] };
  }

  getSetupGuide(): AdapterSetupGuideDefinition | null {
    return {
      namespace: 'qq',
      sectionTitleKey: 'getCredentialsTitle',
      steps: [
        { titleKey: 'step1Title', border: 'green', body: { kind: 'rich', messageKey: 'step1Body' } },
        { titleKey: 'step2Title', border: 'green', body: { kind: 'plain', messageKey: 'step2Body' } },
        { titleKey: 'step3Title', border: 'green', body: { kind: 'rich', messageKey: 'step3Body' } },
        {
          titleKey: 'step4Title',
          border: 'green',
          body: {
            kind: 'paragraphAndCodeBlock',
            paragraphKey: 'step4Body',
            codeBlockMessageKey: 'step4ExampleUrl',
          },
        },
        {
          titleKey: 'step5Title',
          border: 'green',
          body: {
            kind: 'paragraphAndList',
            paragraphKey: 'step5Body',
            listItemKeys: ['eventC2C', 'eventGroupAt', 'eventDirect', 'eventAt'],
          },
        },
      ],
      tipKey: 'tip',
      warns: [{ titleKey: 'warnTitle', listKeys: ['warnPassive', 'warnActive'] }],
      usage: {
        lines: [
          { kind: 'lead', key: 'usage1' },
          { kind: 'lead', key: 'usage2' },
          { kind: 'lead', key: 'usage3' },
          { kind: 'lead', key: 'usage4' },
          { kind: 'field', key: 'usage4AppId' },
          { kind: 'field', key: 'usage4Secret' },
          { kind: 'lead', key: 'usage5' },
          { kind: 'lead', key: 'usage6' },
          { kind: 'lead', key: 'usage7' },
        ],
      },
    };
  }

  getBotConfigUISchema(): FormUISchema {
    return {
      fields: [
        {
          name: 'appId',
          label: 'AppID',
          type: 'text',
          required: true,
          placeholder: '从 QQ 开放平台获取',
        },
        {
          name: 'appSecret',
          label: 'AppSecret',
          type: 'password',
          required: true,
          placeholder: '从 QQ 开放平台获取',
        },
      ],
    };
  }

  createBot(config: BotConfig): QQBot {
    return new QQBot(config);
  }

  /**
   * 解析 QQ 回调事件
   * 
   * Payload 结构:
   * {
   *   "id": "event_id",
   *   "op": 0,        // 0=Dispatch, 12=HTTP Callback ACK, 13=回调地址验证
   *   "d": {},        // 事件数据
   *   "s": 42,        // 序列号
   *   "t": "EVENT_NAME"
   * }
   */
  async parseEvent(botId: string, rawData: unknown, headers: Record<string, string>): Promise<BotEvent | null> {
    const payload = rawData as any;
    const op = payload.op;
    const eventType = payload.t;
    const data = payload.d;

    // op=13 回调地址验证 不产生业务事件
    if (op === 13) {
      return null;
    }

    // op=0 Dispatch 事件
    if (op === 0 && eventType && data) {
      return this.parseDispatchEvent(botId, eventType, data, payload);
    }

    return null;
  }

  private parseDispatchEvent(botId: string, eventType: string, data: any, payload: any): BotEvent | null {
    const messageEvents = [
      'C2C_MESSAGE_CREATE',
      'GROUP_AT_MESSAGE_CREATE',
      'AT_MESSAGE_CREATE',
      'MESSAGE_CREATE',
      'DIRECT_MESSAGE_CREATE',
    ];

    if (messageEvents.includes(eventType)) {
      return this.parseMessageEvent(botId, eventType, data, payload);
    }

    const groupRobotEvents = [
      'GROUP_ADD_ROBOT',
      'GROUP_DEL_ROBOT',
      'GROUP_MSG_REJECT',
      'GROUP_MSG_RECEIVE',
    ];
    if (groupRobotEvents.includes(eventType)) {
      return this.parseGroupRobotNotice(botId, eventType, data, payload);
    }

    const guildMemberEvents = ['GUILD_MEMBER_ADD', 'GUILD_MEMBER_REMOVE'];
    if (guildMemberEvents.includes(eventType)) {
      return this.parseGuildMemberNotice(botId, eventType, data, payload);
    }

    if (eventType === 'INTERACTION_CREATE') {
      return this.parseInteractionCreate(botId, data, payload);
    }

    const messageDeleteEvents = ['MESSAGE_DELETE', 'PUBLIC_MESSAGE_DELETE', 'DIRECT_MESSAGE_DELETE'];
    if (messageDeleteEvents.includes(eventType)) {
      return this.parseMessageDeleteNotice(botId, eventType, data, payload);
    }

    const reactionEvents = ['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'];
    if (reactionEvents.includes(eventType)) {
      return this.parseMessageReactionNotice(botId, eventType, data, payload);
    }

    if (eventType === 'GUILD_MEMBER_UPDATE') {
      return this.parseGuildMemberUpdateNotice(botId, data, payload);
    }

    const auditEvents = ['MESSAGE_AUDIT_PASS', 'MESSAGE_AUDIT_REJECT'];
    if (auditEvents.includes(eventType)) {
      return this.parseMessageAuditNotice(botId, eventType, data, payload);
    }

    console.log(`[QQ] Unhandled event type: ${eventType}`);
    return null;
  }

  private qqTimestampMs(data: { timestamp?: string | number }): number {
    const ts = data.timestamp;
    if (typeof ts === 'number') {
      return ts < 1e12 ? ts * 1000 : ts;
    }
    if (typeof ts === 'string') {
      const parsed = Date.parse(ts);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return Date.now();
  }

  private attachmentsToSegments(attachments: unknown): { segments: Message; hints: string[] } {
    const segments: Message = [];
    const hints: string[] = [];
    if (!Array.isArray(attachments)) return { segments, hints };
    for (const raw of attachments) {
      if (!raw || typeof raw !== 'object') continue;
      const a = raw as {
        content_type?: string;
        url?: string;
        voice_wav_url?: string;
        filename?: string;
        asr_refer_text?: string;
      };
      const ct = (a.content_type || '').toLowerCase();
      const url = a.url || a.voice_wav_url;
      const asr = a.asr_refer_text != null ? String(a.asr_refer_text) : '';
      if (ct.startsWith('image/') && url) {
        segments.push({ type: 'image', data: { url } });
        hints.push('[图片]');
      } else if (ct === 'file' || ct.includes('octet-stream')) {
        if (url) segments.push({ type: 'file', data: { url, file_name: a.filename } });
        hints.push(a.filename ? `[文件:${a.filename}]` : '[文件]');
      } else if (ct.includes('video')) {
        if (url) segments.push({ type: 'video', data: { url } });
        hints.push(asr || '[视频]');
      } else if (ct === 'voice' || ct.includes('audio') || ct.includes('voice')) {
        if (url) segments.push({ type: 'audio', data: { url } });
        hints.push(asr || '[语音]');
      } else if (url) {
        segments.push({ type: 'file', data: { url, file_name: a.filename } });
        hints.push(a.filename ? `[附件:${a.filename}]` : '[附件]');
      }
    }
    return { segments, hints };
  }

  private parseGroupRobotNotice(
    botId: string,
    eventType: string,
    data: {
      timestamp?: number;
      group_openid?: string;
      op_member_openid?: string;
    },
    payload: any,
  ): NoticeEvent {
    const subTypeMap: Partial<Record<string, NoticeEventSubType>> = {
      GROUP_ADD_ROBOT: 'group_member_increase',
      GROUP_DEL_ROBOT: 'group_member_decrease',
      GROUP_MSG_REJECT: 'custom',
      GROUP_MSG_RECEIVE: 'custom',
    };
    const subType = subTypeMap[eventType] ?? 'custom';
    const ts =
      typeof data.timestamp === 'number'
        ? data.timestamp < 1e12
          ? data.timestamp * 1000
          : data.timestamp
        : Date.now();

    return {
      id: generateId(),
      type: 'notice',
      subType,
      platform: 'qq',
      botId,
      timestamp: ts,
      sender: {
        userId: String(data.op_member_openid || ''),
        nickname: undefined,
        role: 'normal',
      },
      groupId: data.group_openid,
      operatorId: data.op_member_openid,
      extra: {
        event_type: eventType,
        matchContent: eventType,
      },
      raw: payload,
    } satisfies NoticeEvent;
  }

  /** 频道/私信消息撤回或删除（私域 MESSAGE_DELETE、公域 PUBLIC_MESSAGE_DELETE、私信 DIRECT_MESSAGE_DELETE） */
  private parseMessageDeleteNotice(botId: string, eventType: string, data: any, payload: any): NoticeEvent {
    const ts = this.qqTimestampMs(data);
    const msgId = data.id ?? data.message_id ?? data.message?.id ?? '';
    const channelId = data.channel_id ?? data.sub_channel_id ?? data.message?.channel_id;
    const guildId = data.guild_id ?? data.message?.guild_id;
    const author = data.author ?? data.message?.author ?? {};
    const userId = author.id ?? author.user_openid ?? author.member_openid ?? '';

    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'qq',
      botId,
      timestamp: ts,
      sender: { userId: String(userId), nickname: author.username || author?.nick, role: 'normal' },
      groupId: guildId != null ? String(guildId) : channelId != null ? String(channelId) : undefined,
      extra: {
        event_type: eventType,
        matchContent: eventType,
        message_id: msgId,
        channel_id: channelId,
      },
      raw: payload,
    } satisfies NoticeEvent;
  }

  private parseMessageReactionNotice(botId: string, eventType: string, data: any, payload: any): NoticeEvent {
    const ts = this.qqTimestampMs(data);
    const channelId = data.channel_id ?? data.target?.channel_id;
    const guildId = data.guild_id ?? data.target?.guild_id;
    const msgId =
      data.message_id ?? data.target?.id ?? data.target?.message_id ?? data.target?.message?.id ?? '';
    const user = data.user ?? data.member?.user ?? {};
    const userId = user.id ?? user.member_openid ?? '';
    const emojiRaw = data.emoji ?? data.reaction?.emoji;
    const emojiLabel =
      typeof emojiRaw === 'string'
        ? emojiRaw
        : emojiRaw && typeof emojiRaw === 'object'
          ? String(
              (emojiRaw as { name?: string; id?: string; type?: number }).name ||
                (emojiRaw as { id?: string }).id ||
                '',
            )
          : '';

    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'qq',
      botId,
      timestamp: ts,
      sender: { userId: String(userId), nickname: user.username, role: 'normal' },
      groupId: guildId != null ? String(guildId) : channelId != null ? String(channelId) : undefined,
      extra: {
        event_type: eventType,
        matchContent: eventType,
        message_id: msgId,
        channel_id: channelId,
        emoji: emojiLabel || emojiRaw,
        action: eventType === 'MESSAGE_REACTION_ADD' ? 'add' : 'remove',
      },
      raw: payload,
    } satisfies NoticeEvent;
  }

  private parseGuildMemberUpdateNotice(botId: string, data: any, payload: any): NoticeEvent {
    const ts = this.qqTimestampMs(data);
    const uid =
      data.user?.id ?? data.member?.user?.id ?? data.member?.user?.member_openid ?? data.member_openid ?? '';

    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'qq',
      botId,
      timestamp: ts,
      sender: {
        userId: String(uid),
        nickname: data.member?.user?.username || data.user?.username,
        role: 'normal',
      },
      groupId: data.guild_id != null ? String(data.guild_id) : undefined,
      extra: { event_type: 'GUILD_MEMBER_UPDATE', matchContent: 'GUILD_MEMBER_UPDATE' },
      raw: payload,
    } satisfies NoticeEvent;
  }

  private parseMessageAuditNotice(botId: string, eventType: string, data: any, payload: any): NoticeEvent {
    const ts = this.qqTimestampMs(data);
    const guildId = data.guild_id;
    const channelId = data.channel_id;
    const author = data.author ?? data.message?.author ?? {};
    const userId = author.id ?? author.user_openid ?? '';

    return {
      id: generateId(),
      type: 'notice',
      subType: 'custom',
      platform: 'qq',
      botId,
      timestamp: ts,
      sender: { userId: String(userId), role: 'normal' as UserRole },
      groupId: guildId != null ? String(guildId) : channelId != null ? String(channelId) : undefined,
      extra: {
        event_type: eventType,
        matchContent: eventType,
        message_id: data.message_id ?? data.message?.id,
        audit_result: eventType === 'MESSAGE_AUDIT_PASS' ? 'pass' : 'reject',
      },
      raw: payload,
    } satisfies NoticeEvent;
  }

  private parseGuildMemberNotice(botId: string, eventType: string, data: any, payload: any): NoticeEvent {
    const subType: NoticeEventSubType =
      eventType === 'GUILD_MEMBER_ADD' ? 'group_member_increase' : 'group_member_decrease';
    const uid =
      data.user?.id ||
      data.member?.user?.id ||
      data.member?.user?.member_openid ||
      data.member_openid ||
      '';
    const opId = data.op_user_id || data.operator_id || data.inviter_id;
    const ts = this.qqTimestampMs(data);

    return {
      id: generateId(),
      type: 'notice',
      subType,
      platform: 'qq',
      botId,
      timestamp: ts,
      sender: {
        userId: String(uid),
        nickname: data.member?.user?.username || data.user?.username,
        role: 'normal',
      },
      groupId: data.guild_id ? String(data.guild_id) : data.channel_id ? String(data.channel_id) : undefined,
      operatorId: opId != null ? String(opId) : undefined,
      targetId: data.user?.id != null ? String(data.user.id) : undefined,
      extra: { event_type: eventType, matchContent: eventType },
      raw: payload,
    } satisfies NoticeEvent;
  }

  private parseInteractionCreate(botId: string, data: any, payload: any): MessageEvent {
    const isGroup = !!data.guild_id;
    const cmdName =
      data.data?.name ||
      data.application_command?.name ||
      data.data?.resolved?.name ||
      '';
    const rawContent = cmdName ? `/${cmdName}`.trim() : 'INTERACTION_CREATE';
    const ts = this.qqTimestampMs(data);
    const userId =
      data.member?.user?.id ||
      data.user?.id ||
      data.channel?.user_id ||
      '';
    const nickname = data.member?.user?.username || data.user?.username || '';

    return {
      id: generateId(),
      type: 'message',
      subType: isGroup ? 'group' : 'private',
      platform: 'qq',
      botId,
      timestamp: ts,
      sender: {
        userId: String(userId),
        nickname,
        role: 'normal' as UserRole,
      },
      content: [{ type: 'text', data: { text: rawContent } }],
      rawContent,
      groupId: isGroup ? data.guild_id || data.channel_id : undefined,
      messageId: String(data.id || data.token || generateId()),
      raw: payload,
    };
  }

  private parseMessageEvent(botId: string, eventType: string, data: any, payload: any): MessageEvent {
    // 判断消息场景
    let subType: 'private' | 'group' = 'private';
    let groupId: string | undefined;

    if (eventType === 'C2C_MESSAGE_CREATE') {
      subType = 'private';
    } else if (eventType === 'GROUP_AT_MESSAGE_CREATE') {
      subType = 'group';
      groupId = data.group_openid;
    } else if (eventType === 'AT_MESSAGE_CREATE' || eventType === 'MESSAGE_CREATE') {
      subType = 'group';
      groupId = data.channel_id;
    } else if (eventType === 'DIRECT_MESSAGE_CREATE') {
      subType = 'private';
    }

    const text = typeof data.content === 'string' ? data.content : '';
    const { segments, hints } = this.attachmentsToSegments(data.attachments);
    const parts: Message = [];
    if (text.trim()) parts.push({ type: 'text', data: { text } });
    parts.push(...segments);
    const rawContent = [text.trim(), ...hints.filter((h) => h && h !== text.trim())]
      .filter(Boolean)
      .join('\n')
      .trim();

    const messageId = data.id;
    const timestamp = this.qqTimestampMs(data);

    const author = data.author || {};
    const member = data.member || {};

    return {
      id: generateId(),
      type: 'message',
      subType,
      platform: 'qq',
      botId,
      timestamp,
      sender: {
        userId: author.id || author.user_openid || author.member_openid || '',
        nickname: member.nick || author.username || '',
        role: 'normal' as UserRole,
      },
      content: parts.length ? parts : text ? [{ type: 'text', data: { text } }] : [],
      rawContent: rawContent || text,
      groupId,
      messageId,
      raw: payload,
    };
  }

  /**
   * 验证 Webhook 签名
   * 
   * QQ 使用 Ed25519 签名：
   * - X-Signature-Ed25519: 签名（hex）
   * - X-Signature-Timestamp: 时间戳
   * - User-Agent: QQBot-Callback（可用于额外验证）
   * - 签名体 = timestamp + body
   * - 使用 App Secret 派生的公钥验证
   */
  async verifyWebhook(
    rawData: unknown,
    headers: Record<string, string>,
    config: Record<string, unknown>,
    _query?: Record<string, string>
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const appSecret = config.appSecret as string;
      if (!appSecret) {
        console.warn('[QQ] AppSecret not configured, allowing request');
        return true;
      }

      // 检查 User-Agent（可选但推荐）
      const userAgent = headers['user-agent'] || '';
      if (userAgent && userAgent !== 'QQBot-Callback') {
        console.warn('[QQ] Unexpected User-Agent:', userAgent);
      }

      const signature = headers['x-signature-ed25519'];
      const timestamp = headers['x-signature-timestamp'];

      if (!signature || !timestamp) {
        console.error('[QQ] Missing signature headers');
        return false;
      }

      const body = typeof rawData === 'string' ? rawData : JSON.stringify(rawData);

      console.log('[QQ] Verifying signature...');
      console.log('[QQ]   Timestamp:', timestamp);
      console.log('[QQ]   Signature:', signature.substring(0, 20) + '...');
      console.log('[QQ]   Body preview:', body.substring(0, 100) + '...');

      const isValid = QQEd25519.verify(appSecret, signature, timestamp, body);
      const duration = Date.now() - startTime;

      if (isValid) {
        console.log(`[QQ] ✓ Signature verification PASSED (${duration}ms)`);
      } else {
        console.error(`[QQ] ✗ Signature verification FAILED (${duration}ms)`);
      }

      return isValid;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[QQ] Webhook verification error after ${duration}ms:`, error);
      return false;
    }
  }

  /**
   * 生成 Webhook 响应
   * 
   * QQ Bot Webhook 响应规范：
   * - OpCode 13（回调验证）：需返回 { plain_token, signature }
   * - OpCode 0（事件推送）：返回 { op: 12 } 表示 HTTP Callback ACK
   * - 其他 OpCode：返回 { op: 12 } ACK
   */
  getWebhookResponse(payload?: any): WebhookResponse {
    const op = payload?.op;

    // 回调地址验证（OpCode 13）
    // 注意：实际签名在 webhook route 中处理，因为需要 appSecret
    if (op === 13) {
      const data = payload.d;
      const plainToken = data?.plain_token;
      const eventTs = data?.event_ts;

      console.log('[QQ] OpCode 13: Callback verification request');
      console.log('[QQ]   plain_token:', plainToken?.substring(0, 10) + '...');
      console.log('[QQ]   event_ts:', eventTs);
      
      // 返回占位符，实际签名在 route 中处理
      return {
        status: 200,
        body: { plain_token: plainToken, signature: '__NEED_SIGN__' },
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // 普通事件返回 ACK（OpCode 12）
    console.log('[QQ] Sending ACK (OpCode 12)');
    return {
      status: 200,
      body: { op: 12 },
      headers: { 'Content-Type': 'application/json' },
    };
  }

  /**
   * 生成回调验证的签名响应
   * 这个方法需要 appSecret，在 webhook route 中调用
   */
  static generateValidationResponse(appSecret: string, plainToken: string, eventTs: string): { plain_token: string; signature: string } {
    const signature = QQEd25519.sign(appSecret, eventTs, plainToken);
    return { plain_token: plainToken, signature };
  }

  getSupportedFeatures(): AdapterFeature[] {
    return ['message', 'group', 'user', 'notice', 'file', 'recall', 'reaction'];
  }
}
