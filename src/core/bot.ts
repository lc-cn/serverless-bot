import {
  Message,
  SendResult,
  SendTarget,
  User,
  UserDetail,
  Group,
  GroupDetail,
  BotEvent,
} from '@/types';

/**
 * Bot 抽象基类
 * 所有平台的 Bot 实现都必须继承此类并实现所有抽象方法
 */
export abstract class Bot {
  /** Bot ID */
  public readonly id: string;
  
  /** 所属平台 */
  public readonly platform: string;
  
  /** Bot 名称 */
  public readonly name: string;

  /** 创建者用户 ID（用于解析 LLM Agent 等租户资源） */
  public readonly ownerId?: string;
  
  /** Bot 配置 */
  protected config: Record<string, unknown>;

  constructor(
    id: string,
    platform: string,
    name: string,
    config: Record<string, unknown>,
    ownerId?: string
  ) {
    this.id = id;
    this.platform = platform;
    this.name = name;
    this.config = config;
    this.ownerId = ownerId;
  }

  // ==================== 消息发送 ====================

  /**
   * 统一的消息发送方法
   * @param target 发送目标（私聊/群聊）
   * @param message 消息内容（消息段数组）
   * @returns 发送结果
   */
  abstract sendMessage(target: SendTarget, message: Message): Promise<SendResult>;

  /**
   * 发送私聊消息的便捷方法
   */
  async sendPrivateMessage(userId: string, message: Message): Promise<SendResult> {
    return this.sendMessage({ type: 'private', userId }, message);
  }

  /**
   * 发送群消息的便捷方法
   */
  async sendGroupMessage(groupId: string, message: Message): Promise<SendResult> {
    return this.sendMessage({ type: 'group', groupId }, message);
  }

  /**
   * 发送纯文本消息的便捷方法
   */
  async sendText(target: SendTarget, text: string): Promise<SendResult> {
    return this.sendMessage(target, [{ type: 'text', data: { text } }]);
  }

  // ==================== 用户相关 ====================

  /**
   * 获取用户列表
   * @param groupId 群组ID（可选，如果提供则获取群成员列表）
   * @returns 用户列表
   */
  abstract getUserList(groupId?: string): Promise<User[]>;

  /**
   * 获取用户详情
   * @param userId 用户ID
   * @param groupId 群组ID（可选，用于获取群内用户信息）
   * @returns 用户详情
   */
  abstract getUserDetail(userId: string, groupId?: string): Promise<UserDetail | null>;

  // ==================== 群组相关 ====================

  /**
   * 获取群组列表
   * @returns 群组列表
   */
  abstract getGroupList(): Promise<Group[]>;

  /**
   * 获取群组详情
   * @param groupId 群组ID
   * @returns 群组详情
   */
  abstract getGroupDetail(groupId: string): Promise<GroupDetail | null>;

  // ==================== 请求处理 ====================

  /**
   * 处理好友请求
   * @param flag 请求标识
   * @param approve 是否同意
   * @param remark 备注（可选）
   */
  abstract handleFriendRequest(
    flag: string,
    approve: boolean,
    remark?: string
  ): Promise<boolean>;

  /**
   * 处理群组邀请/加群请求
   * @param flag 请求标识
   * @param approve 是否同意
   * @param reason 拒绝理由（可选）
   */
  abstract handleGroupRequest(
    flag: string,
    approve: boolean,
    reason?: string
  ): Promise<boolean>;

  // ==================== 其他操作 ====================

  /**
   * 撤回消息
   * @param messageId 消息ID
   */
  abstract recallMessage(messageId: string): Promise<boolean>;

  /**
   * 获取登录信息
   */
  abstract getLoginInfo(): Promise<{ userId: string; nickname: string }>;

  // ==================== 事件回复 ====================

  /**
   * 快速回复事件
   * @param event 原始事件
   * @param message 回复消息
   */
  async reply(event: BotEvent, message: Message): Promise<SendResult> {
    if (event.type !== 'message') {
      return { success: false, error: 'Can only reply to message events' };
    }

    const target: SendTarget = event.subType === 'group'
      ? { type: 'group', groupId: (event as any).groupId }
      : { type: 'private', userId: event.sender.userId };

    return this.sendMessage(target, message);
  }

  /**
   * 快速回复文本
   */
  async replyText(event: BotEvent, text: string): Promise<SendResult> {
    return this.reply(event, [{ type: 'text', data: { text } }]);
  }
}

/**
 * Bot 工厂方法类型
 */
export type BotFactory = (
  id: string,
  config: Record<string, unknown>
) => Bot;
