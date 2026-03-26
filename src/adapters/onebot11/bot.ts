import { Bot } from '@/core/bot';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { Message, SendResult, SendTarget, User, UserDetail, Group, GroupDetail, BotConfig } from '@/types';

/**
 * 通过 OneBot 11 兼容 HTTP API 发信（如 go-cqhttp / NapCat 等暴露的侧）。
 * - send_private_msg / send_group_msg
 */
export class OneBot11Bot extends Bot {
  private apiBase: string;
  private accessToken: string;

  constructor(config: BotConfig) {
    super(config.id, 'onebot11', config.name, config.config, config.ownerId);
    const base = ((config.config.apiBaseUrl as string) || '').replace(/\/+$/, '');
    this.apiBase = base;
    this.accessToken = (config.config.accessToken as string) || '';
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<{ data?: unknown; retcode?: number; status?: string }> {
    if (!this.apiBase) {
      throw new Error('apiBaseUrl is empty');
    }
    const url = `${this.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    const response = await undiciFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      dispatcher,
    });
    const text = await response.text();
    let data: { data?: unknown; retcode?: number; status?: string };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(`OneBot API non-JSON (${response.status}): ${text.slice(0, 200)}`);
    }
    if (!response.ok) {
      throw new Error(`OneBot HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    if (typeof data.retcode === 'number' && data.retcode !== 0) {
      throw new Error(`OneBot retcode ${data.retcode}`);
    }
    return data;
  }

  private segmentsToMessageString(message: Message): string {
    const parts: string[] = [];
    for (const seg of message) {
      if (seg.type === 'text') {
        parts.push((seg.data as { text?: string }).text ?? '');
      } else if (seg.type === 'at') {
        const uid = (seg.data as { userId?: string }).userId;
        parts.push(uid ? `[CQ:at,qq=${uid}]` : '');
      } else if (seg.type === 'image') {
        const d = seg.data as { url?: string; file?: string };
        const file = d.file || d.url;
        if (file) parts.push(`[CQ:image,file=${file}]`);
      }
    }
    return parts.join('').trim() || '';
  }

  async sendMessage(target: SendTarget, message: Message): Promise<SendResult> {
    try {
      const text = this.segmentsToMessageString(message);
      if (!text) {
        return { success: false, error: 'Empty message (only plain text / at / image CQ supported)' };
      }
      if (target.type === 'private') {
        if (!target.userId) return { success: false, error: 'userId required' };
        const uid = Number(target.userId);
        if (!Number.isFinite(uid)) return { success: false, error: 'Invalid userId' };
        const res = await this.postJson('/send_private_msg', {
          user_id: uid,
          message: text,
          auto_escape: false,
        });
        const mid = (res.data as { message_id?: number })?.message_id;
        return { success: true, messageId: mid != null ? String(mid) : undefined };
      }
      if (!target.groupId) return { success: false, error: 'groupId required' };
      const gid = Number(target.groupId);
      if (!Number.isFinite(gid)) return { success: false, error: 'Invalid groupId' };
      const res = await this.postJson('/send_group_msg', {
        group_id: gid,
        message: text,
        auto_escape: false,
      });
      const mid = (res.data as { message_id?: number })?.message_id;
      return { success: true, messageId: mid != null ? String(mid) : undefined };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[OneBot11] sendMessage failed', msg);
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
    return { userId: '', nickname: this.name };
  }
}
