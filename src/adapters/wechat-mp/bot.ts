import { Bot } from '@/core/bot';
import { wechatMpPassiveReplyStorage } from '@/lib/runtime/wechat-mp-passive-context';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { BotConfig, Message, SendResult, SendTarget, User, UserDetail, Group, GroupDetail } from '@/types';
import { buildWechatMpPassiveTextXml } from './passive-reply';

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * 微信公众号：客服消息接口发文本（需用户在 48 小时内有互动）。
 * @see https://developers.weixin.qq.com/doc/offiaccount/Message_Management/Service_Center_messages.html
 */
export class WechatMpBot extends Bot {
  private appId: string;
  private appSecret: string;

  constructor(config: BotConfig) {
    super(config.id, 'wechat_mp', config.name, config.config, config.ownerId);
    const c = config.config || {};
    this.appId = String(c.appId || '').trim();
    this.appSecret = String(c.appSecret || '').trim();
  }

  private async getAccessToken(): Promise<string> {
    if (!this.appId || !this.appSecret) {
      throw new Error('appId / appSecret missing');
    }
    const now = Date.now();
    const hit = tokenCache.get(this.appId);
    if (hit && hit.expiresAt > now + 60_000) {
      return hit.token;
    }
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(this.appId)}&secret=${encodeURIComponent(this.appSecret)}`;
    const res = await undiciFetch(url, { dispatcher });
    const j = (await res.json()) as { access_token?: string; expires_in?: number; errmsg?: string; errcode?: number };
    if (!j.access_token) {
      throw new Error(j.errmsg || `WeChat token error ${j.errcode}`);
    }
    const expiresIn = Number(j.expires_in) || 7200;
    tokenCache.set(this.appId, { token: j.access_token, expiresAt: now + expiresIn * 1000 });
    return j.access_token;
  }

  private static segmentsToText(message: Message): string {
    const parts: string[] = [];
    for (const seg of message) {
      if (seg.type === 'text') {
        parts.push((seg.data as { text?: string }).text ?? '');
      } else if (seg.type === 'at') {
        parts.push(`@${(seg.data as { userId?: string }).userId || ''}`);
      }
    }
    return parts.join('').trim();
  }

  async sendMessage(target: SendTarget, message: Message): Promise<SendResult> {
    try {
      if (target.type !== 'private' || !target.userId) {
        return { success: false, error: 'WeChat MP only supports replying by user openid (private)' };
      }
      const content = WechatMpBot.segmentsToText(message);
      if (!content) {
        return { success: false, error: 'Empty or unsupported message (text only)' };
      }

      const passive = wechatMpPassiveReplyStorage.getStore();
      if (
        passive?.useEncryptedPassiveReply &&
        passive.encodingAESKey &&
        target.userId === passive.inboundFields.FromUserName
      ) {
        passive.bufferedPlainXml = buildWechatMpPassiveTextXml(passive.inboundFields, content);
        return { success: true };
      }

      const accessToken = await this.getAccessToken();
      const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
      const url = `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${encodeURIComponent(accessToken)}`;
      const res = await undiciFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          touser: target.userId,
          msgtype: 'text',
          text: { content },
        }),
        dispatcher,
      });
      const j = (await res.json()) as { errcode?: number; errmsg?: string };
      if (j.errcode != null && j.errcode !== 0) {
        return { success: false, error: j.errmsg || `errcode ${j.errcode}` };
      }
      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[WechatMp] sendMessage failed', msg);
      return { success: false, error: msg };
    }
  }

  async getUserList(_groupId?: string): Promise<User[]> {
    return [];
  }

  async getUserDetail(_userId: string, _groupId?: string): Promise<UserDetail | null> {
    return null;
  }

  async getGroupList(): Promise<Group[]> {
    return [];
  }

  async getGroupDetail(_groupId: string): Promise<GroupDetail | null> {
    return null;
  }

  async handleFriendRequest(_flag: string, _approve: boolean, _remark?: string): Promise<boolean> {
    return false;
  }

  async handleGroupRequest(_flag: string, _approve: boolean, _reason?: string): Promise<boolean> {
    return false;
  }

  async recallMessage(_messageId: string): Promise<boolean> {
    return false;
  }

  async getLoginInfo(): Promise<{ userId: string; nickname: string }> {
    return { userId: this.appId, nickname: this.name };
  }
}
