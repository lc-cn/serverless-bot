import { Bot } from '@/core/bot';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
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
 * Telegram Bot 实现
 */
export class TelegramBot extends Bot {
  private accessToken: string;
  private apiBase: string;

  constructor(config: BotConfig) {
    super(config.id, 'telegram', config.name, config.config, config.ownerId);
    this.accessToken = (config.config.accessToken as string) || '';
    this.apiBase = `https://api.telegram.org/bot${this.accessToken}`;
    console.log('[TelegramBot] Constructor', {
      botId: config.id,
      hasAccessToken: !!this.accessToken,
      accessTokenLength: this.accessToken.length,
      configKeys: Object.keys(config.config || {}),
    });
  }

  /**
   * 调用 Telegram API
   */
  private async callApi<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const url = `${this.apiBase}/${method}`;
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;

    console.debug('[Telegram] callApi environment', {
      method,
      HTTPS_PROXY: process.env.HTTPS_PROXY,
      HTTP_PROXY: process.env.HTTP_PROXY,
      proxyResolved: proxy,
      dispatcherCreated: !!dispatcher,
    });

    try {
      const response = await undiciFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: params ? JSON.stringify(params) : undefined,
        dispatcher,
      });

      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Telegram API non-JSON response (status ${response.status}): ${text.slice(0, 120)}...`);
      }

      if (!data.ok) {
        throw new Error(data.description || `Telegram API error (status ${response.status})`);
      }

      return data.result as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Telegram] callApi failed', { method, url, useProxy: !!dispatcher, error: msg });
      throw err;
    }
  }

  /**
   * 将统一消息格式转换为 Telegram 消息
   */
  private convertMessage(message: Message): { text: string; entities?: unknown[] } {
    let text = '';
    const entities: unknown[] = [];

    for (const segment of message) {
      if (segment.type === 'text') {
        text += segment.data.text;
      } else if (segment.type === 'at') {
        const mention = `@${segment.data.name || segment.data.userId}`;
        entities.push({
          type: 'mention',
          offset: text.length,
          length: mention.length,
        });
        text += mention;
      }
    }

    return { text, entities: entities.length > 0 ? entities : undefined };
  }

  // ==================== 消息发送 ====================

  async sendMessage(target: SendTarget, message: Message): Promise<SendResult> {
    try {
      const { text, entities } = this.convertMessage(message);
      const chatId = target.type === 'private' ? target.userId : target.groupId;
      if (!this.accessToken) {
        return { success: false, error: 'Telegram access token missing' };
      }
      if (!chatId) {
        return { success: false, error: 'chat_id not resolved' };
      }
      console.debug('[Telegram] sendMessage', { targetType: target.type, chatId, textLen: text.length });

      const result = await this.callApi<{ message_id: number }>('sendMessage', {
        chat_id: chatId,
        text,
        entities,
      });

      return {
        success: true,
        messageId: String(result.message_id),
      };
    } catch (error) {
      console.error('[Telegram] sendMessage failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ==================== 用户相关 ====================

  async getUserList(groupId?: string): Promise<User[]> {
    if (!groupId) {
      // Telegram 不支持获取所有用户列表
      return [];
    }

    try {
      const result = await this.callApi<{ user: { id: number; first_name: string } }[]>(
        'getChatAdministrators',
        { chat_id: groupId }
      );

      return result.map((member) => ({
        id: String(member.user.id),
        name: member.user.first_name,
        role: 'admin' as const,
      }));
    } catch {
      return [];
    }
  }

  async getUserDetail(userId: string, groupId?: string): Promise<UserDetail | null> {
    try {
      if (groupId) {
        const result = await this.callApi<{
          user: { id: number; first_name: string; last_name?: string; username?: string };
          status: string;
        }>('getChatMember', { chat_id: groupId, user_id: userId });

        const role = ['creator', 'administrator'].includes(result.status)
          ? result.status === 'creator'
            ? 'owner'
            : 'admin'
          : 'normal';

        return {
          id: String(result.user.id),
          name: result.user.first_name,
          nickname: result.user.last_name
            ? `${result.user.first_name} ${result.user.last_name}`
            : result.user.first_name,
          role: role as 'normal' | 'admin' | 'owner',
          extra: { username: result.user.username },
        };
      } else {
        // 当没有 groupId 时，无法获取详细用户信息
        // Telegram API 限制：只能在群组中获取其他用户信息
        // 在私聊中，只能通过 Bot 接收到的信息了解用户
        return null;
      }
    } catch (error) {
      console.error('[Telegram] getUserDetail error:', error);
      return null;
    }
  }

  // ==================== 群组相关 ====================

  async getGroupList(): Promise<Group[]> {
    // Telegram 不支持获取群组列表
    return [];
  }

  async getGroupDetail(groupId: string): Promise<GroupDetail | null> {
    try {
      const result = await this.callApi<{
        id: number;
        title: string;
        description?: string;
        photo?: { small_file_id: string };
      }>('getChat', { chat_id: groupId });

      const memberCount = await this.callApi<number>('getChatMemberCount', {
        chat_id: groupId,
      });

      return {
        id: String(result.id),
        name: result.title,
        description: result.description,
        memberCount,
      };
    } catch {
      return null;
    }
  }

  // ==================== 请求处理 ====================

  async handleFriendRequest(
    flag: string,
    approve: boolean,
    remark?: string
  ): Promise<boolean> {
    // Telegram 不需要手动处理好友请求
    return true;
  }

  async handleGroupRequest(
    flag: string,
    approve: boolean,
    reason?: string
  ): Promise<boolean> {
    // Telegram 通过 Bot API 不能处理加群请求
    return true;
  }

  // ==================== 其他操作 ====================

  async recallMessage(messageId: string): Promise<boolean> {
    // 需要 chat_id，这里简化处理
    return false;
  }

  async getLoginInfo(): Promise<{ userId: string; nickname: string }> {
    try {
      const result = await this.callApi<{
        id: number;
        first_name: string;
        username?: string;
      }>('getMe');

      return {
        userId: String(result.id),
        nickname: result.first_name,
      };
    } catch {
      return { userId: '', nickname: '' };
    }
  }
}
