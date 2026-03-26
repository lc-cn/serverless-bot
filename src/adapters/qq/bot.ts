import { Bot } from '@/core/bot';
import {
  Message,
  SendResult,
  SendTarget,
  User,
  UserDetail,
  Group,
  GroupDetail,
  BotConfig,
} from '@/types';

/**
 * QQ 机器人 API v2
 * 文档: https://bot.q.qq.com/wiki/develop/api-v2/
 */
export class QQBot extends Bot {
  private appId: string;
  private appSecret: string;
  private apiBase: string = 'https://api.sgroup.qq.com';
  private tokenEndpoint: string = 'https://bots.qq.com/app/getAppAccessToken';

  // Access Token 缓存
  private accessToken: string = '';
  private tokenExpiresAt: number = 0;

  constructor(config: BotConfig) {
    super(config.id, 'qq', config.name, config.config, config.ownerId);
    this.appId = (config.config.appId as string) || '';
    this.appSecret = (config.config.appSecret as string) || '';
  }

  /**
   * 获取 Access Token（带缓存）
   */
  private async getAccessToken(): Promise<string> {
    // 提前 60 秒刷新
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    try {
      const response = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: this.appId,
          clientSecret: this.appSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
      }

      const data = await response.json() as { access_token: string; expires_in: string | number };
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (parseInt(String(data.expires_in)) * 1000);

      console.log('[QQBot] Access token refreshed, expires in:', data.expires_in, 's');
      return this.accessToken;
    } catch (error) {
      console.error('[QQBot] Failed to get access token:', error);
      throw error;
    }
  }

  /**
   * 调用 QQ OpenAPI
   */
  private async callApi<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.apiBase}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `QQBot ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`QQ API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error('[QQBot] API call failed', { method, path, error });
      throw error;
    }
  }

  /**
   * 发送消息
   * 支持：单聊、群聊、频道子频道
   */
  async sendMessage(target: SendTarget, message: Message): Promise<SendResult> {
    try {
      let content = '';
      for (const segment of message) {
        if (segment.type === 'text') {
          content += segment.data.text;
        } else if (segment.type === 'at') {
          // QQ @格式
          content += `<@${segment.data.userId}>`;
        }
      }

      if (!content) {
        return { success: false, error: 'No text content' };
      }

      // 构造消息体
      const msgBody: Record<string, unknown> = {
        content,
        msg_type: 0, // 文本消息
      };

      // 如果有 msg_id（被动消息），则加上
      // 通过 groupId 传递额外信息：格式 "groupId:msgId:eventId"
      const parts = target.groupId?.split(':') || [];
      const actualGroupId = parts[0];
      const msgId = parts[1];
      const eventId = parts[2];
      
      if (msgId) {
        msgBody.msg_id = msgId;
      }
      if (eventId) {
        msgBody.event_id = eventId;
      }

      let result: any;

      if (target.type === 'private') {
        // 单聊：/v2/users/{openid}/messages
        result = await this.callApi<any>('POST', `/v2/users/${target.userId}/messages`, msgBody);
      } else if (target.type === 'group') {
        // 群聊：/v2/groups/{group_openid}/messages
        result = await this.callApi<any>('POST', `/v2/groups/${actualGroupId}/messages`, msgBody);
      } else if ((target as any).type === 'channel') {
        // 频道子频道：/channels/{channel_id}/messages
        result = await this.callApi<any>('POST', `/channels/${actualGroupId}/messages`, msgBody);
      } else {
        return { success: false, error: 'Invalid target type' };
      }

      return { success: true, messageId: result?.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getUserList(groupId?: string): Promise<User[]> {
    // QQ API v2 暂无直接获取群成员列表的接口（群聊场景）
    // 频道场景可用 /guilds/{guild_id}/members
    if (!groupId) return [];

    try {
      // 尝试频道成员接口
      const members = await this.callApi<any>('GET', `/guilds/${groupId}/members?limit=100`);
      if (Array.isArray(members)) {
        return members.map((m: any) => ({
          id: m.user?.id || '',
          name: m.nick || m.user?.username || '',
          role: 'normal' as const,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  async getUserDetail(userId: string): Promise<UserDetail | null> {
    // QQ API v2 没有直接的用户详情接口
    // 可通过频道接口获取 /guilds/{guild_id}/members/{user_id}
    return null;
  }

  async getGroupList(): Promise<Group[]> {
    // 获取机器人加入的频道列表
    try {
      const guilds = await this.callApi<any[]>('GET', '/users/@me/guilds');
      return guilds.map((g) => ({ id: g.id, name: g.name }));
    } catch {
      return [];
    }
  }

  async getGroupDetail(groupId: string): Promise<GroupDetail | null> {
    try {
      const guild = await this.callApi<any>('GET', `/guilds/${groupId}`);
      return { id: guild.id, name: guild.name, description: guild.description };
    } catch {
      return null;
    }
  }

  async handleFriendRequest(flag: string, approve: boolean, remark?: string): Promise<boolean> {
    // QQ 机器人不支持好友请求处理
    return true;
  }

  async handleGroupRequest(flag: string, approve: boolean, reason?: string): Promise<boolean> {
    // QQ 机器人不支持群请求处理
    return true;
  }

  async recallMessage(messageId: string, channelId?: string): Promise<boolean> {
    // 撤回消息需要 channel_id
    if (!channelId) return false;
    try {
      // 频道消息撤回
      await this.callApi<any>('DELETE', `/channels/${channelId}/messages/${messageId}?hidetip=false`);
      return true;
    } catch {
      return false;
    }
  }

  async getLoginInfo(): Promise<{ userId: string; nickname: string }> {
    try {
      const me = await this.callApi<any>('GET', '/users/@me');
      return { userId: me.id || this.appId, nickname: me.username || 'QQ Bot' };
    } catch {
      return { userId: this.appId, nickname: 'QQ Bot' };
    }
  }
}
