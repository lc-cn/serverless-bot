import { z } from 'zod';
import { Adapter, FormUISchema, AdapterFeature, WebhookResponse } from '@/core/adapter';
import { QQBot } from './bot';
import { BotConfig, BotEvent, MessageEvent, UserRole } from '@/types';
import { generateId } from '@/lib/utils';
import { QQEd25519 } from '@/lib/qq-ed25519';

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
    // 消息事件类型映射
    const messageEvents = [
      'C2C_MESSAGE_CREATE',       // 单聊消息
      'GROUP_AT_MESSAGE_CREATE',  // 群聊@机器人消息
      'AT_MESSAGE_CREATE',        // 频道@机器人消息
      'MESSAGE_CREATE',           // 频道消息（私域）
      'DIRECT_MESSAGE_CREATE',    // 频道私信
    ];

    if (messageEvents.includes(eventType)) {
      return this.parseMessageEvent(botId, eventType, data, payload);
    }

    // 其他事件暂不处理（可扩展）
    console.log(`[QQ] Unhandled event type: ${eventType}`);
    return null;
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

    // 提取消息内容
    const content = data.content || '';
    const messageId = data.id;
    const timestamp = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();

    // 发送者信息
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
        userId: author.id || author.user_openid || data.author?.member_openid || '',
        nickname: member.nick || author.username || '',
        role: 'normal' as UserRole,
      },
      content: [{ type: 'text', data: { text: content } }],
      rawContent: content,
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
  async verifyWebhook(rawData: unknown, headers: Record<string, string>, config: Record<string, unknown>): Promise<boolean> {
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
    return ['message', 'group', 'user'];
  }
}
