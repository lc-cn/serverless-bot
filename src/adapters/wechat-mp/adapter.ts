import { z } from 'zod';
import {
  Adapter,
  FormUISchema,
  AdapterFeature,
  type WebhookGetResult,
  type WebhookResponse,
} from '@/core/adapter';
import type { AdapterSetupGuideDefinition } from '@/core/adapter-setup-guide';
import { WechatMpBot } from './bot';
import type { BotConfig, BotEvent, MessageEvent } from '@/types';
import { generateId } from '@/lib/shared/utils';
import { wechatMpVerifySignature } from './xml';
import { wechatMpDecrypt, wechatMpVerifyMsgSignature } from './crypto';
import { processWechatMpWebhook } from './inbound';
import { buildWechatMpEncryptedPassiveXml } from './passive-reply';
import { wechatMpPassiveReplyStorage } from '@/lib/runtime/wechat-mp-passive-context';

export class WechatMpAdapter extends Adapter {
  constructor() {
    super(
      'wechat_mp',
      '微信公众号',
      '微信公众平台：AES 加解密、同步 Webhook 下流程被动密文回复或客服接口发文本',
      '💬',
    );
  }

  getAdapterConfigSchema(): z.ZodSchema {
    return z.object({});
  }

  getBotConfigSchema(): z.ZodSchema {
    return z.object({
      appId: z.string().min(1, 'AppID 不能为空'),
      appSecret: z.string().min(1, 'AppSecret 不能为空'),
      token: z.string().min(1, '服务器配置 Token 不能为空'),
      encodingAESKey: z
        .string()
        .optional()
        .refine(
          (s) => s == null || s === '' || s.trim().length === 43,
          'EncodingAESKey 须为公众平台生成的 43 位，或留空（仅明文模式）',
        ),
    });
  }

  getBotConfigUISchema(): FormUISchema {
    return {
      fields: [
        {
          name: 'appId',
          label: 'AppID',
          type: 'text',
          required: true,
          placeholder: '开发者 ID (AppID)',
          description: '公众平台 开发 → 基本配置 中的 AppID。',
        },
        {
          name: 'appSecret',
          label: 'AppSecret',
          type: 'password',
          required: true,
          placeholder: 'AppSecret',
          description: '用于获取 access_token，请勿泄露。',
        },
        {
          name: 'token',
          label: '服务器配置 Token',
          type: 'password',
          required: true,
          placeholder: '与公众平台「服务器配置」一致',
          description: '用于 URL 校验；明文为 signature，安全/兼容模式为 msg_signature 组签名之一。',
        },
        {
          name: 'encodingAESKey',
          label: 'EncodingAESKey（可选）',
          type: 'password',
          required: false,
          placeholder: '43 位，与公众平台「消息加解密」一致；留空=仅明文',
          description:
            '启用安全模式或兼容模式时必填；平台随机生成 43 位。留空时按明文解析与验签。',
        },
      ],
    };
  }

  getSetupGuide(): AdapterSetupGuideDefinition | null {
    return {
      namespace: 'wechat_mp',
      sectionTitleKey: 'setupTitle',
      steps: [
        { titleKey: 'step1Title', border: 'green', body: { kind: 'rich', messageKey: 'step1Body' } },
        { titleKey: 'step2Title', border: 'green', body: { kind: 'rich', messageKey: 'step2Body' } },
        {
          titleKey: 'step3Title',
          border: 'indigo',
          body: {
            kind: 'paragraphAndCodeBlock',
            paragraphKey: 'step3Body',
            codeBlockMessageKey: 'step3ExampleUrl',
          },
        },
        { titleKey: 'step4Title', border: 'indigo', body: { kind: 'plain', messageKey: 'step4Body' } },
      ],
      tipKey: 'tip',
      usage: {
        lines: [
          { kind: 'lead', key: 'usage1' },
          { kind: 'lead', key: 'usage2' },
          { kind: 'field', key: 'usageFieldAppId' },
          { kind: 'field', key: 'usageFieldSecret' },
          { kind: 'field', key: 'usageFieldToken' },
          { kind: 'field', key: 'usageFieldEncodingAESKey' },
          { kind: 'lead', key: 'usage3' },
          { kind: 'lead', key: 'usage4' },
        ],
      },
    };
  }

  createBot(config: BotConfig): WechatMpBot {
    return new WechatMpBot(config);
  }

  handleWebhookGet(query: Record<string, string>, botConfig: Record<string, unknown>): WebhookGetResult | null {
    const echostr = query.echostr;
    const signature = query.signature;
    const timestamp = query.timestamp;
    const nonce = query.nonce;
    const token = String(botConfig.token || '');
    const appId = String(botConfig.appId || '').trim();
    const aesKey = String(botConfig.encodingAESKey || '').trim();

    if (echostr == null || timestamp == null || nonce == null) {
      return null;
    }

    const msgSig = (query.msg_signature || '').trim();
    if (msgSig) {
      if (!aesKey || !appId) {
        return { type: 'plain', body: 'forbidden', status: 403 };
      }
      if (!wechatMpVerifyMsgSignature(token, timestamp, nonce, echostr, msgSig)) {
        return { type: 'plain', body: 'forbidden', status: 403 };
      }
      try {
        const plain = wechatMpDecrypt(echostr, aesKey, appId);
        return { type: 'plain', body: plain };
      } catch {
        return { type: 'plain', body: 'forbidden', status: 403 };
      }
    }

    if (signature == null) {
      return null;
    }
    if (!wechatMpVerifySignature(token, timestamp, nonce, signature)) {
      return { type: 'plain', body: 'forbidden', status: 403 };
    }
    return { type: 'plain', body: echostr };
  }

  async parseEvent(botId: string, rawData: unknown, _headers: Record<string, string>): Promise<BotEvent | null> {
    const fields = rawData as Record<string, string>;
    if (!fields || typeof fields !== 'object') return null;

    const msgType = fields.MsgType;
    if (msgType === 'event') {
      return null;
    }
    if (msgType !== 'text') {
      return null;
    }

    const from = fields.FromUserName;
    const content = fields.Content || '';
    const msgId = fields.MsgId;
    const createTime = Number(fields.CreateTime) || Math.floor(Date.now() / 1000);

    if (!from || !msgId) return null;

    return {
      id: generateId(),
      type: 'message',
      subType: 'private',
      platform: 'wechat_mp',
      botId,
      timestamp: createTime * 1000,
      sender: {
        userId: from,
        nickname: undefined,
        role: 'normal',
      },
      content: content ? [{ type: 'text', data: { text: content } }] : [],
      rawContent: content,
      messageId: msgId,
      raw: fields,
    } satisfies MessageEvent;
  }

  async verifyWebhook(
    rawData: unknown,
    _headers: Record<string, string>,
    config: Record<string, unknown>,
    query?: Record<string, string>
  ): Promise<boolean> {
    if (typeof rawData !== 'string' || !query) return false;
    return processWechatMpWebhook(rawData, config, query).ok;
  }

  getWebhookResponse(_interaction?: unknown): WebhookResponse {
    const store = wechatMpPassiveReplyStorage.getStore();
    if (store?.bufferedPlainXml && store.encodingAESKey && store.appId) {
      try {
        const xml = buildWechatMpEncryptedPassiveXml(
          store.bufferedPlainXml,
          store.token,
          store.encodingAESKey,
          store.appId
        );
        return {
          status: 200,
          body: xml,
          headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        };
      } catch (e) {
        console.error('[WechatMp] encrypted passive reply build failed', e);
      }
    }
    return {
      status: 200,
      body: 'success',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    };
  }

  getSupportedFeatures(): AdapterFeature[] {
    return ['message', 'user'];
  }
}
