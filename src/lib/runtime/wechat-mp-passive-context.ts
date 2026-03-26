import { AsyncLocalStorage } from 'node:async_hooks';

/** 同步 Webhook 内由流程「发送消息」写入，供 getWebhookResponse 输出被动回复（密文 XML） */
export interface WechatMpPassiveReplyStore {
  inboundFields: Record<string, string>;
  token: string;
  appId: string;
  encodingAESKey: string;
  /** 已配置 EncodingAESKey 且未开启 webhook 异步时使用被动密文回复 */
  useEncryptedPassiveReply: boolean;
  /** 被动回复内层明文 XML（未加密） */
  bufferedPlainXml?: string;
}

export const wechatMpPassiveReplyStorage = new AsyncLocalStorage<WechatMpPassiveReplyStore>();
