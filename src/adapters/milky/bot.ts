import { Bot } from '@/core/bot';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { BotConfig, Message, SendResult, SendTarget, User, UserDetail, Group, GroupDetail } from '@/types';

/**
 * Milky 协议 HTTP API 客户端（协议端 /api）。
 * @see https://milky.ntqqrev.org/guide/communication
 * @see https://milky.ntqqrev.org/api/message
 */
export class MilkyBot extends Bot {
  private apiBase: string;
  private accessToken: string;

  constructor(config: BotConfig) {
    super(config.id, 'milky', config.name, config.config, config.ownerId);
    this.apiBase = String(config.config.apiBaseUrl || '')
      .trim()
      .replace(/\/+$/, '');
    this.accessToken = String(config.config.accessToken || '').trim();
  }

  private async postApi(apiMethod: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!this.apiBase) {
      throw new Error('apiBaseUrl is empty');
    }
    const path = apiMethod.startsWith('/') ? apiMethod : `/api/${apiMethod}`;
    const url = `${this.apiBase}${path}`;
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
    let data: {
      status?: string;
      retcode?: number;
      message?: string;
      data?: Record<string, unknown>;
    };
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Milky API non-JSON (${response.status}): ${text.slice(0, 200)}`);
    }
    if (response.status === 401) {
      throw new Error('Milky: unauthorized (401)');
    }
    if (data.status === 'failed' || (typeof data.retcode === 'number' && data.retcode !== 0)) {
      throw new Error(data.message || `Milky retcode ${data.retcode}`);
    }
    return (data.data as Record<string, unknown>) || {};
  }

  /** 将站内 Message 转为 Milky OutgoingSegment[] */
  private toMilkySegments(message: Message): Array<{ type: string; data: Record<string, unknown> }> {
    const out: Array<{ type: string; data: Record<string, unknown> }> = [];
    for (const seg of message) {
      if (seg.type === 'text') {
        out.push({ type: 'text', data: { text: (seg.data as { text?: string }).text ?? '' } });
      } else if (seg.type === 'at') {
        const uid = (seg.data as { userId?: string }).userId;
        if (uid === 'all') {
          out.push({ type: 'mention_all', data: {} });
        } else {
          const n = uid != null ? Number(uid) : NaN;
          if (Number.isFinite(n)) {
            out.push({ type: 'mention', data: { user_id: n } });
          }
        }
      } else if (seg.type === 'image') {
        const d = seg.data as { url?: string; file?: string };
        const uri = d.file || d.url;
        if (uri) {
          out.push({ type: 'image', data: { uri, sub_type: 'normal' } });
        }
      }
    }
    return out;
  }

  async sendMessage(target: SendTarget, message: Message): Promise<SendResult> {
    try {
      const segs = this.toMilkySegments(message);
      if (segs.length === 0) {
        return { success: false, error: 'Empty message (text / mention / image supported)' };
      }
      if (target.type === 'private') {
        if (!target.userId) return { success: false, error: 'userId required' };
        const uid = Number(target.userId);
        if (!Number.isFinite(uid)) return { success: false, error: 'Invalid userId' };
        const res = await this.postApi('send_private_message', {
          user_id: uid,
          message: segs,
        });
        const seq = res.message_seq != null ? String(res.message_seq) : undefined;
        return { success: true, messageId: seq };
      }
      if (!target.groupId) return { success: false, error: 'groupId required' };
      const gid = Number(target.groupId);
      if (!Number.isFinite(gid)) return { success: false, error: 'Invalid groupId' };
      const res = await this.postApi('send_group_message', {
        group_id: gid,
        message: segs,
      });
      const seq = res.message_seq != null ? String(res.message_seq) : undefined;
      return { success: true, messageId: seq };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Milky] sendMessage failed', msg);
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
    try {
      const data = await this.postApi('get_login_info', {});
      const uid =
        data.uin != null
          ? String(data.uin)
          : data.user_id != null
            ? String(data.user_id)
            : '';
      const nk = (data.nickname as string) || this.name;
      return { userId: uid, nickname: nk };
    } catch {
      return { userId: '', nickname: this.name };
    }
  }
}
