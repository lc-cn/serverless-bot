import { Bot } from '@/core/bot';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { BotConfig, BotEvent, Message, SendResult, SendTarget, User, UserDetail, Group, GroupDetail } from '@/types';

/**
 * Satori 协议 HTTP 客户端：调用 SDK 暴露的 /v1/*.create 式 RPC。
 * @see https://satori.chat/zh-CN/protocol/api.html
 */
export class SatoriBot extends Bot {
  private apiBase: string;
  private apiToken: string;
  /** Satori-Platform，与 bridge 上登录的平台名一致 */
  private satoriPlatform: string;
  /** Satori-User-ID，当前机器人账号在该平台上的用户 ID */
  private satoriUserId: string;

  constructor(config: BotConfig) {
    super(config.id, 'satori', config.name, config.config, config.ownerId);
    const c = config.config || {};
    this.apiBase = String(c.apiBaseUrl || '')
      .trim()
      .replace(/\/+$/, '');
    this.apiToken = String(c.apiToken || '').trim();
    this.satoriPlatform = String(c.satoriPlatform || '').trim();
    this.satoriUserId = String(c.satoriUserId || '').trim();
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'Satori-Platform': this.satoriPlatform,
      'Satori-User-ID': this.satoriUserId,
    };
    if (this.apiToken) {
      h.Authorization = `Bearer ${this.apiToken}`;
    }
    return h;
  }

  private async postRpc(methodPath: string, body: Record<string, unknown>): Promise<unknown> {
    if (!this.apiBase) throw new Error('apiBaseUrl is empty');
    if (!this.satoriPlatform || !this.satoriUserId) {
      throw new Error('satoriPlatform and satoriUserId are required for Satori API');
    }
    const url = `${this.apiBase}/v1/${methodPath}`;
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
    const response = await undiciFetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      dispatcher,
    });
    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Satori API non-JSON (${response.status}): ${text.slice(0, 200)}`);
    }
    if (!response.ok) {
      throw new Error(`Satori HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    if (
      json &&
      typeof json === 'object' &&
      'code' in json &&
      (json as { code: number }).code !== 0
    ) {
      const msg = (json as { message?: string }).message || JSON.stringify(json);
      throw new Error(`Satori RPC error: ${msg}`);
    }
    if (json && typeof json === 'object' && 'data' in json) {
      return (json as { data: unknown }).data;
    }
    return json;
  }

  private segmentsToContent(message: Message): string {
    const parts: string[] = [];
    for (const seg of message) {
      if (seg.type === 'text') {
        parts.push((seg.data as { text?: string }).text ?? '');
      } else if (seg.type === 'at') {
        const uid = (seg.data as { userId?: string }).userId;
        if (uid) parts.push(`<at id="${uid}"/>`);
      }
    }
    return parts.join('').trim();
  }

  private async messageCreate(channelId: string, content: string): Promise<SendResult> {
    if (!content) {
      return { success: false, error: 'Empty message' };
    }
    const data = await this.postRpc('message.create', { channel_id: channelId, content });
    const arr = Array.isArray(data) ? data : data != null ? [data] : [];
    const first = arr[0] as { id?: string } | undefined;
    const messageId = first?.id != null ? String(first.id) : undefined;
    return { success: true, messageId };
  }

  async sendMessage(target: SendTarget, message: Message): Promise<SendResult> {
    try {
      const content = this.segmentsToContent(message);
      if (target.type === 'group' && target.groupId) {
        return await this.messageCreate(target.groupId, content);
      }
      if (target.type === 'private' && target.userId) {
        const ch = await this.postRpc('user.channel.create', { user_id: target.userId });
        const cid =
          ch && typeof ch === 'object' && 'id' in ch ? String((ch as { id: string }).id) : '';
        if (!cid) return { success: false, error: 'user.channel.create returned no channel id' };
        return await this.messageCreate(cid, content);
      }
      return { success: false, error: 'Invalid send target' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Satori] sendMessage failed', msg);
      return { success: false, error: msg };
    }
  }

  /** 回复使用事件里记录的频道 ID（Satori 私聊也需 channel_id，不能仅用 userId） */
  override async reply(event: BotEvent, message: Message): Promise<SendResult> {
    if (event.type !== 'message') {
      return { success: false, error: 'Can only reply to message events' };
    }
    const raw = event.raw as { __satori?: { channelId: string } } | undefined;
    const channelId = raw?.__satori?.channelId;
    if (!channelId) {
      return { success: false, error: 'Missing Satori channel id on event' };
    }
    try {
      const content = this.segmentsToContent(message);
      return await this.messageCreate(channelId, content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Satori] reply failed', msg);
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
    return { userId: this.satoriUserId, nickname: this.name };
  }
}
