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
 * Discord Bot 实现
 */
export class DiscordBot extends Bot {
  private token: string;
  private apiBase: string = 'https://discord.com/api/v10';

  constructor(config: BotConfig) {
    super(config.id, 'discord', config.name, config.config, config.ownerId);
    this.token = (config.config.token as string) || '';
  }

  /**
   * 调用 Discord API
   */
  private async callApi<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.apiBase}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${this.token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error('[Discord] API call failed', { method, path, error });
      throw error;
    }
  }

  async sendMessage(target: SendTarget, message: Message): Promise<SendResult> {
    try {
      let content = '';
      for (const segment of message) {
        if (segment.type === 'text') {
          content += segment.data.text;
        } else if (segment.type === 'at') {
          content += `<@${segment.data.userId || segment.data.name}>`;
        }
      }

      if (!content) {
        return { success: false, error: 'No text content' };
      }

      if (target.type === 'private') {
        const dmChannel = await this.callApi<any>('POST', '/users/@me/channels', {
          recipient_id: target.userId,
        });
        const result = await this.callApi<any>('POST', `/channels/${dmChannel.id}/messages`, {
          content,
        });
        return { success: true, messageId: result.id };
      } else if (target.type === 'group') {
        const result = await this.callApi<any>('POST', `/channels/${target.groupId}/messages`, {
          content,
        });
        return { success: true, messageId: result.id };
      }

      return { success: false, error: 'Invalid target type' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getUserList(groupId?: string): Promise<User[]> {
    if (!groupId) return [];
    try {
      const members = await this.callApi<any[]>('GET', `/guilds/${groupId}/members?limit=100`, undefined);
      return members.map((m) => ({
        id: m.user.id,
        name: m.nick || m.user.username,
        role: 'normal' as const,
      }));
    } catch {
      return [];
    }
  }

  async getUserDetail(userId: string, groupId?: string): Promise<UserDetail | null> {
    try {
      let user: any;
      if (groupId) {
        const member = await this.callApi<any>('GET', `/guilds/${groupId}/members/${userId}`, undefined);
        user = member.user;
      } else {
        user = await this.callApi<any>('GET', `/users/${userId}`, undefined);
      }
      return {
        id: user.id,
        name: user.username,
        nickname: user.global_name || user.username,
        role: 'normal' as const,
      };
    } catch {
      return null;
    }
  }

  async getGroupList(): Promise<Group[]> {
    try {
      const guilds = await this.callApi<any[]>('GET', '/users/@me/guilds', undefined);
      return guilds.map((g) => ({ id: g.id, name: g.name }));
    } catch {
      return [];
    }
  }

  async getGroupDetail(groupId: string): Promise<GroupDetail | null> {
    try {
      const guild = await this.callApi<any>('GET', `/guilds/${groupId}`, undefined);
      return { id: guild.id, name: guild.name, description: guild.description };
    } catch {
      return null;
    }
  }

  async handleFriendRequest(flag: string, approve: boolean, remark?: string): Promise<boolean> {
    return true;
  }

  async handleGroupRequest(flag: string, approve: boolean, reason?: string): Promise<boolean> {
    return true;
  }

  async recallMessage(messageId: string): Promise<boolean> {
    return false;
  }

  async getLoginInfo(): Promise<{ userId: string; nickname: string }> {
    try {
      const result = await this.callApi<any>('GET', '/users/@me', undefined);
      return { userId: result.id, nickname: result.username };
    } catch {
      return { userId: '', nickname: '' };
    }
  }
}
