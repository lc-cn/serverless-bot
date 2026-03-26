import { Bot } from '@/core/bot';
import {
  BotConfig,
  BotEvent,
  Group,
  GroupDetail,
  Message,
  SendResult,
  SendTarget,
  User,
  UserDetail,
} from '@/types';

/** 沙盒对话 HTTP 响应：流程中发往用户侧的消息快照 */
export interface SandboxOutboundCapture {
  at: number;
  target: SendTarget;
  text: string;
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 沙盒 Bot：不向外部 IM 发请求；captureOutbound 时收集 sendMessage 供 /api/chat/sandbox 回显。
 */
export class SandboxBot extends Bot {
  readonly outboundCaptures: SandboxOutboundCapture[] = [];

  constructor(config: BotConfig) {
    super(config.id, 'sandbox', config.name, config.config, config.ownerId);
  }

  private messageToPlainText(message: Message): string {
    return message
      .map((s) => {
        if (s.type === 'text' && typeof s.data?.text === 'string') return s.data.text;
        if (s.type === 'at') {
          const d = s.data as { userId?: string; name?: string };
          return `[@${d.name ?? d.userId ?? '?'}]`;
        }
        return '';
      })
      .join('');
  }

  async sendMessage(target: SendTarget, message: Message): Promise<SendResult> {
    const text = this.messageToPlainText(message);
    const result: SendResult = {
      success: true,
      messageId: `sandbox_msg_${Date.now()}`,
    };
    if (this.config.captureOutbound === true) {
      this.outboundCaptures.push({
        at: Date.now(),
        target: { ...target },
        text,
        success: result.success,
        messageId: result.messageId,
      });
    }
    console.info('[SandboxBot] sendMessage', {
      botId: this.id,
      target,
      textPreview: text.slice(0, 500),
    });
    return result;
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
    return true;
  }

  async handleGroupRequest(_flag: string, _approve: boolean, _reason?: string): Promise<boolean> {
    return true;
  }

  async recallMessage(messageId: string): Promise<boolean> {
    console.info('[SandboxBot] recallMessage', { botId: this.id, messageId });
    return true;
  }

  async getLoginInfo(): Promise<{ userId: string; nickname: string }> {
    return { userId: `sandbox_bot_${this.id}`, nickname: this.name || 'Sandbox' };
  }

  override async reply(event: BotEvent, message: Message): Promise<SendResult> {
    console.info('[SandboxBot] reply', { botId: this.id, eventId: event.id, eventType: event.type });
    return super.reply(event, message);
  }
}
