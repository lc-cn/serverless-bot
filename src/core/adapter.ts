import { z } from 'zod';
import { Bot } from './bot';
import { BotEvent, BotConfig } from '@/types';

/**
 * Adapter 抽象基类
 * 所有平台适配器都必须继承此类并实现所有抽象方法
 */
export abstract class Adapter {
  /** 平台标识 */
  public readonly platform: string;
  
  /** 适配器名称 */
  public readonly name: string;
  
  /** 适配器描述 */
  public readonly description: string;
  
  /** 适配器图标（可选） */
  public readonly icon?: string;

  /** 已创建的 Bot 实例缓存 */
  protected bots: Map<string, Bot> = new Map();

  constructor(
    platform: string,
    name: string,
    description: string,
    icon?: string
  ) {
    this.platform = platform;
    this.name = name;
    this.description = description;
    this.icon = icon;
  }

  // ==================== Schema 定义 ====================

  /**
   * 获取 Adapter 配置的 Zod Schema
   * 用于验证和定义适配器级别的配置
   */
  abstract getAdapterConfigSchema(): z.ZodSchema;

  /**
   * 获取 Bot 配置的 Zod Schema
   * 用于验证和定义 Bot 级别的配置
   */
  abstract getBotConfigSchema(): z.ZodSchema;

  /**
   * 获取 Adapter 配置表单的 UI 描述
   * 用于前端动态生成配置表单
   */
  getAdapterConfigUISchema(): FormUISchema {
    return { fields: [] };
  }

  /**
   * 获取 Bot 配置表单的 UI 描述
   * 用于前端动态生成配置表单
   */
  getBotConfigUISchema(): FormUISchema {
    return { fields: [] };
  }

  // ==================== Bot 管理 ====================

  /**
   * 创建 Bot 实例
   * @param config Bot 配置
   * @returns Bot 实例
   */
  abstract createBot(config: BotConfig): Bot;

  /**
   * 获取或创建 Bot 实例
   */
  getOrCreateBot(config: BotConfig): Bot {
    const existingBot = this.bots.get(config.id);
    if (existingBot) {
      return existingBot;
    }

    const bot = this.createBot(config);
    this.bots.set(config.id, bot);
    return bot;
  }

  /**
   * 获取 Bot 实例
   */
  getBot(botId: string): Bot | undefined {
    return this.bots.get(botId);
  }

  /**
   * 移除 Bot 实例
   */
  removeBot(botId: string): boolean {
    return this.bots.delete(botId);
  }

  /**
   * 清空所有 Bot 实例
   */
  clearBots(): void {
    this.bots.clear();
  }

  // ==================== 事件处理 ====================

  /**
   * 解析原始 Webhook 数据为统一事件格式
   * @param botId Bot ID
   * @param rawData 原始请求数据
   * @param headers 请求头
   * @returns 解析后的事件，如果无法解析返回 null
   */
  abstract parseEvent(
    botId: string,
    rawData: unknown,
    headers: Record<string, string>
  ): Promise<BotEvent | null>;

  /**
   * 验证 Webhook 请求的有效性
   * @param rawData 原始请求数据
   * @param headers 请求头
   * @param config 适配器配置
   * @returns 是否验证通过
   */
  abstract verifyWebhook(
    rawData: unknown,
    headers: Record<string, string>,
    config: Record<string, unknown>
  ): Promise<boolean>;

  /**
   * 获取 Webhook 响应
   * 某些平台需要特定的响应格式
   * @param interaction 原始交互数据（某些平台需要检查）
   */
  getWebhookResponse(interaction?: any): WebhookResponse {
    return { status: 200, body: { ok: true } };
  }

  // ==================== 适配器信息 ====================

  /**
   * 获取适配器信息
   */
  getInfo(): AdapterInfo {
    return {
      platform: this.platform,
      name: this.name,
      description: this.description,
      icon: this.icon,
    };
  }

  /**
   * 检查适配器是否支持某功能
   */
  supportsFeature(feature: AdapterFeature): boolean {
    return this.getSupportedFeatures().includes(feature);
  }

  /**
   * 获取支持的功能列表
   */
  getSupportedFeatures(): AdapterFeature[] {
    return ['message', 'group', 'user'];
  }
}

// ==================== 辅助类型 ====================

export interface AdapterInfo {
  platform: string;
  name: string;
  description: string;
  icon?: string;
}

export interface WebhookResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export type AdapterFeature = 
  | 'message'      // 消息收发
  | 'group'        // 群组管理
  | 'user'         // 用户管理
  | 'file'         // 文件上传下载
  | 'recall'       // 消息撤回
  | 'request'      // 请求处理
  | 'notice'       // 通知事件
  | 'reaction';    // 消息反应

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea';
  placeholder?: string;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string | number }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface FormUISchema {
  fields: FormField[];
}

// ==================== 适配器注册表 ====================

class AdapterRegistry {
  private adapters: Map<string, Adapter> = new Map();

  register(adapter: Adapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  get(platform: string): Adapter | undefined {
    return this.adapters.get(platform);
  }

  getAll(): Adapter[] {
    return Array.from(this.adapters.values());
  }

  has(platform: string): boolean {
    return this.adapters.has(platform);
  }

  remove(platform: string): boolean {
    return this.adapters.delete(platform);
  }

  clear(): void {
    this.adapters.clear();
  }
}

export const adapterRegistry = new AdapterRegistry();
