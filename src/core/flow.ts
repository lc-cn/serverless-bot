import {
  BotEvent,
  MessageEvent,
  RequestEvent,
  NoticeEvent,
  Flow,
  Job,
  Step,
  Trigger,
  MatchRule,
  PermissionRule,
  UserRole,
  Message,
  MessageSegment,
  FlowAction,
} from '@/types';
import { Bot } from './bot';

/**
 * 消息构建器
 */
export class MessageBuilder {
  private segments: MessageSegment[] = [];

  text(content: string): this {
    this.segments.push({ type: 'text', data: { text: content } });
    return this;
  }

  image(url: string, file?: string): this {
    this.segments.push({ type: 'image', data: { url, ...(file && { file }) } });
    return this;
  }

  at(userId: string, name?: string): this {
    this.segments.push({ type: 'at', data: { userId, ...(name && { name }) } });
    return this;
  }

  reply(messageId: string): this {
    this.segments.push({ type: 'reply', data: { messageId } });
    return this;
  }

  face(faceId: string): this {
    this.segments.push({ type: 'face', data: { id: faceId } });
    return this;
  }

  build(): Message {
    return this.segments;
  }

  static parse(template: string, context: Record<string, unknown>): Message {
    // 简单的模板解析：支持 [text:xxx] [at:userId] [image:url] 等格式
    const segments: MessageSegment[] = [];
    const regex = /\[(\w+):([^\]]+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(template)) !== null) {
      // 添加前面的纯文本
      if (match.index > lastIndex) {
        const text = template.slice(lastIndex, match.index);
        if (text) {
          segments.push({ type: 'text', data: { text } });
        }
      }

      const [, type, content] = match;
      switch (type) {
        case 'text':
          segments.push({ type: 'text', data: { text: content } });
          break;
        case 'at':
          segments.push({ type: 'at', data: { userId: content } });
          break;
        case 'image':
          segments.push({ type: 'image', data: { url: content } });
          break;
        case 'reply':
          segments.push({ type: 'reply', data: { messageId: content } });
          break;
        case 'face':
          segments.push({ type: 'face', data: { id: content } });
          break;
      }

      lastIndex = regex.lastIndex;
    }

    // 添加剩余文本
    if (lastIndex < template.length) {
      const text = template.slice(lastIndex);
      if (text) {
        segments.push({ type: 'text', data: { text } });
      }
    }

    return segments.length > 0 ? segments : [{ type: 'text', data: { text: template } }];
  }
}

/**
 * Job 执行上下文
 */
export interface JobContext {
  event: BotEvent;
  bot: Bot;
  flow: Flow;
  job: Job;
  variables: Record<string, unknown>;
  stepResults: StepResult[];
}

/**
 * Step 执行结果
 */
export interface StepResult {
  stepId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

/**
 * Job 执行结果
 */
export interface JobResult {
  jobId: string;
  executed: boolean;
  steps: StepResult[];
  error?: string;
  duration: number;
}

/**
 * Flow 执行结果
 */
export interface FlowExecutionResult {
  flowId: string;
  matched: boolean;
  executed: boolean;
  jobs: JobResult[];
  error?: string;
  duration: number;
}

/**
 * 匹配器：检查事件是否匹配规则
 */
export class Matcher {
  /**
   * 检查事件是否匹配规则，并提取捕获组
   */
  static match(event: BotEvent, rule: MatchRule, variables?: Record<string, unknown>): boolean {
    const content = this.getMatchContent(event);
    
    switch (rule.type) {
      case 'always':
        return true;
      
      case 'keyword':
        // 关键词匹配：检查是否包含该关键词
        return rule.ignoreCase
          ? content.toLowerCase().includes(rule.pattern.toLowerCase())
          : content.includes(rule.pattern);
      
      case 'exact':
        return rule.ignoreCase
          ? content.toLowerCase() === rule.pattern.toLowerCase()
          : content === rule.pattern;
      
      case 'prefix':
        return rule.ignoreCase
          ? content.toLowerCase().startsWith(rule.pattern.toLowerCase())
          : content.startsWith(rule.pattern);
      
      case 'suffix':
        return rule.ignoreCase
          ? content.toLowerCase().endsWith(rule.pattern.toLowerCase())
          : content.endsWith(rule.pattern);
      
      case 'contains':
        return rule.ignoreCase
          ? content.toLowerCase().includes(rule.pattern.toLowerCase())
          : content.includes(rule.pattern);
      
      case 'regex':
        try {
          const flags = rule.ignoreCase ? 'i' : '';
          const regex = new RegExp(rule.pattern, flags);
          const match = regex.exec(content);
          if (match && variables) {
            // 提取捕获组
            match.forEach((value, index) => {
              if (index > 0) { // 跳过完整匹配
                variables[`match_${index}`] = value;
              }
            });
            variables['match_0'] = match[0]; // 完整匹配
            // 命名捕获组
            if (match.groups) {
              Object.entries(match.groups).forEach(([name, value]) => {
                variables[name] = value;
              });
            }
          }
          return !!match;
        } catch {
          return false;
        }
      
      default:
        return false;
    }
  }

  /**
   * 获取用于匹配的内容
   */
  private static getMatchContent(event: BotEvent): string {
    switch (event.type) {
      case 'message':
        return (event as MessageEvent).rawContent;
      
      case 'request':
        return (event as RequestEvent).comment || '';
      
      case 'notice':
        return (event as NoticeEvent).subType;
      
      default:
        return '';
    }
  }
}

/**
 * 权限检查器
 */
export class PermissionChecker {
  /**
   * 检查事件是否满足权限要求
   */
  static check(event: BotEvent, permission: PermissionRule): boolean {
    // 检查角色
    if (!permission.allowRoles.includes(event.sender.role)) {
      return false;
    }

    // 检查环境
    const environment = this.getEnvironment(event);
    if (!permission.allowEnvironments.includes(environment)) {
      return false;
    }

    // 检查用户黑名单
    if (permission.denyUsers?.includes(event.sender.userId)) {
      return false;
    }

    // 检查用户白名单
    if (permission.allowUsers && permission.allowUsers.length > 0) {
      if (!permission.allowUsers.includes(event.sender.userId)) {
        return false;
      }
    }

    // 检查群组相关权限
    const groupId = this.getGroupId(event);
    if (groupId) {
      if (permission.denyGroups?.includes(groupId)) {
        return false;
      }
      if (permission.allowGroups && permission.allowGroups.length > 0) {
        if (!permission.allowGroups.includes(groupId)) {
          return false;
        }
      }
    }

    return true;
  }

  private static getEnvironment(event: BotEvent): 'private' | 'group' {
    if (event.type === 'message') {
      return (event as MessageEvent).subType === 'group' ? 'group' : 'private';
    }
    // 对于其他类型的事件，有 groupId 就视为群组环境
    const groupId = this.getGroupId(event);
    return groupId ? 'group' : 'private';
  }

  private static getGroupId(event: BotEvent): string | undefined {
    switch (event.type) {
      case 'message':
        return (event as MessageEvent).groupId;
      case 'request':
        return (event as RequestEvent).groupId;
      case 'notice':
        return (event as NoticeEvent).groupId;
      default:
        return undefined;
    }
  }
}

/**
 * Step 执行器
 */
export class StepExecutor {
  /**
   * 构建消息的通用方法
   * 支持三种模式：text（普通文本，支持变量）、template（完整模板）、segments（消息段）
   */
  private static buildMessage(
    config: {
      messageType?: 'text' | 'template' | 'segments';
      content?: string;
      template?: string;
      text?: string;
      segments?: Array<{
        type: 'text' | 'image' | 'at' | 'reply';
        data: Record<string, string>;
      }>;
    },
    context: JobContext
  ): Message {
    const messageType = config.messageType || 'text';

    switch (messageType) {
      case 'template': {
        // 模板模式：支持 ${variable} 和 [type:content] 两种语法
        const templateStr = config.template || config.content || config.text || '';
        const interpolated = this.interpolate(templateStr, context);
        return MessageBuilder.parse(interpolated, context.variables);
      }

      case 'segments': {
        // 消息段模式：直接使用 segments 数组
        if (!config.segments || config.segments.length === 0) {
          return [{ type: 'text', data: { text: '' } }];
        }
        return config.segments.map(seg => ({
          type: seg.type,
          data: Object.fromEntries(
            Object.entries(seg.data).map(([k, v]) => [k, this.interpolate(v, context)])
          )
        })) as Message;
      }

      case 'text':
      default: {
        // 文本模式：普通文本，但也支持 ${variable} 变量插值
        const text = config.content || config.text || config.template || '';
        // 对文本进行变量插值，但不进行消息段解析
        const interpolated = this.interpolate(text, context);
        return [{ type: 'text', data: { text: interpolated } }];
      }
    }
  }

  /**
   * 执行单个 Step
   */
  static async execute(
    step: Step,
    context: JobContext
  ): Promise<StepResult> {
    const startTime = Date.now();

    console.debug('[Step] Start', {
      jobId: context.job.id,
      stepId: step.id,
      stepName: step.name,
      stepType: step.type,
      config: step.config,
      availableVariables: Object.keys(context.variables).length > 0 
        ? Object.entries(context.variables).map(([k, v]) => {
            if (typeof v === 'object' && v !== null) {
              return `${k}: ${JSON.stringify(v).substring(0, 100)}...`;
            }
            return `${k}: ${String(v).substring(0, 100)}`;
          })
        : ['(no variables yet)'],
      stepResults: context.stepResults.length,
    });

    try {
      let data: unknown;

      switch (step.type) {
        case 'call_api':
          data = await this.executeCallApi(step, context);
          break;

        case 'call_bot':
          data = await this.executeCallBot(step, context);
          break;

        case 'send_message':
          data = await this.executeSendMessage(step, context);
          break;

        case 'hardcode':
          data = await this.executeHardcode(step, context);
          break;

        case 'log':
          data = await this.executeLog(step, context);
          break;

        case 'get_user_info':
          data = await this.executeGetUserInfo(step, context);
          break;

        case 'get_group_info':
          data = await this.executeGetGroupInfo(step, context);
          break;

        case 'set_variable':
          data = await this.executeSetVariable(step, context);
          break;

        case 'conditional':
          data = await this.executeConditional(step, context);
          break;

        case 'delay':
          data = await this.executeDelay(step, context);
          break;

        case 'random_reply':
          data = await this.executeRandomReply(step, context);
          break;

        case 'template_message':
          data = await this.executeTemplateMessage(step, context);
          break;

        case 'forward_message':
          data = await this.executeForwardMessage(step, context);
          break;

        case 'handle_request':
          data = await this.executeHandleRequest(step, context);
          break;

        case 'recall_message':
          data = await this.executeRecallMessage(step, context);
          break;

        case 'extract_data':
          data = await this.executeExtractData(step, context);
          break;

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      return {
        stepId: step.id,
        success: true,
        data,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stepId: step.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 调用外部 API
   */
  private static async executeCallApi(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
      saveAs?: string;
    };

    const url = this.interpolate(config.url, context);
    const body = config.body
      ? JSON.parse(this.interpolate(JSON.stringify(config.body), context))
      : undefined;

    const response = await fetch(url, {
      method: config.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (config.saveAs) {
      context.variables[config.saveAs] = data;
    }

    return data;
  }

  /**
   * 调用 Bot 方法
   */
  private static async executeCallBot(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      method: string;
      args?: unknown[];
      saveAs?: string;
    };

    const bot = context.bot as unknown as Record<string, unknown>;
    const method = bot[config.method];

    if (typeof method !== 'function') {
      throw new Error(`Bot method '${config.method}' not found`);
    }

    const args = config.args || [];
    const result = await method.apply(context.bot, args);

    if (config.saveAs) {
      context.variables[config.saveAs] = result;
    }

    return result;
  }

  /**
   * 发送消息
   */
  private static async executeSendMessage(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      messageType?: 'text' | 'template' | 'segments';
      content?: string;
      text?: string;
      template?: string;
      segments?: Array<{
        type: 'text' | 'image' | 'at' | 'reply';
        data: Record<string, string>;
      }>;
      target?: {
        type: 'private' | 'group';
        id: string;
      };
      replyToEvent?: boolean;
    };

    // 使用通用方法构建消息
    const message = this.buildMessage(config, context);

    // 确定发送目标
    let sendResult;
    if (config.target) {
      const targetId = this.interpolate(config.target.id, context);
      const target = config.target.type === 'group'
        ? { type: 'group' as const, groupId: targetId }
        : { type: 'private' as const, userId: targetId };
      sendResult = await context.bot.sendMessage(target, message);
    } else {
      // 默认回复到事件来源
      sendResult = await context.bot.reply(context.event, message);
    }

    if (!sendResult.success) {
      throw new Error(sendResult.error || 'send_message failed');
    }
    
    return { 
      type: 'send_message', 
      message,
      sendResult 
    };
  }

  /**
   * 硬编码内容
   */
  private static async executeHardcode(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      messageType?: 'text' | 'template' | 'segments';
      content?: string;
      text?: string;
      template?: string;
      segments?: Array<{
        type: 'text' | 'image' | 'at' | 'reply';
        data: Record<string, string>;
      }>;
    };

    // 使用通用方法构建消息
    const message = this.buildMessage(config, context);

    // hardcode 步骤默认直接回复
    const sendResult = await context.bot.reply(context.event, message);
    if (!sendResult.success) {
      throw new Error(sendResult.error || 'hardcode reply failed');
    }

    return { type: 'hardcode', message, sendResult };
  }

  /**
   * 记录日志
   */
  private static async executeLog(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      level?: 'debug' | 'info' | 'warn' | 'error';
      message: string;
    };

    const message = this.interpolate(config.message, context);
    const level = config.level || 'info';

    const logEntry = {
      level,
      message,
      flowId: context.flow.id,
      eventId: context.event.id,
      timestamp: Date.now(),
    };

    console[level]('[Flow Log]', logEntry);

    return logEntry;
  }

  /**
   * 获取用户信息
   */
  private static async executeGetUserInfo(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      userId?: string;
      groupId?: string;
      saveAs?: string;
    };

    const userId = config.userId 
      ? this.interpolate(config.userId, context)
      : context.event.sender.userId;
    
    const groupId = config.groupId
      ? this.interpolate(config.groupId, context)
      : undefined;

    console.debug('[get_user_info] Fetching user detail', {
      userId,
      groupId,
      saveAs: config.saveAs,
    });

    // 尝试从 API 获取用户信息
    let userInfo = await context.bot.getUserDetail(userId, groupId);

    // 如果 API 返回 null 且没有 groupId（私聊场景），则使用事件中的信息
    if (!userInfo && !groupId && userId === context.event.sender.userId) {
      console.debug('[get_user_info] API returned null, using event sender info');
      userInfo = {
        id: context.event.sender.userId,
        name: context.event.sender.nickname || context.event.sender.userId,
        nickname: context.event.sender.nickname || context.event.sender.userId,
        role: context.event.sender.role || 'normal',
        extra: { fromEvent: true },
      };
    }

    console.debug('[get_user_info] Got user info', {
      userInfo,
      type: typeof userInfo,
      isNull: userInfo === null,
      isUndefined: userInfo === undefined,
      keys: userInfo ? Object.keys(userInfo as any) : 'N/A',
      stringified: JSON.stringify(userInfo)?.substring(0, 200),
    });

    if (config.saveAs) {
      console.debug('[get_user_info] Saving to context.variables', {
        varName: config.saveAs,
        beforeCount: Object.keys(context.variables).length,
      });
      context.variables[config.saveAs] = userInfo;
      console.debug('[get_user_info] After save, context.variables keys:', {
        keys: Object.keys(context.variables),
        newVarValue: JSON.stringify(context.variables[config.saveAs])?.substring(0, 200),
      });
    }

    return userInfo;
  }

  /**
   * 获取群组信息
   */
  private static async executeGetGroupInfo(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      groupId?: string;
      saveAs?: string;
    };

    let groupId = config.groupId 
      ? this.interpolate(config.groupId, context)
      : undefined;
    
    // 从事件中获取群组ID
    if (!groupId && context.event.type === 'message') {
      groupId = (context.event as MessageEvent).groupId;
    }

    if (!groupId) {
      throw new Error('Group ID not found');
    }

    const groupInfo = await context.bot.getGroupDetail(groupId);

    if (config.saveAs) {
      context.variables[config.saveAs] = groupInfo;
    }

    return groupInfo;
  }

  /**
   * 设置变量
   */
  private static async executeSetVariable(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      name: string;
      value: unknown;
      expression?: string; // 支持表达式计算
    };

    let value: unknown;

    if (config.expression) {
      // 简单的表达式计算：支持基本运算和变量引用
      const expr = this.interpolate(config.expression, context);
      try {
        // eslint-disable-next-line no-eval
        value = eval(expr);
      } catch {
        value = expr;
      }
    } else if (typeof config.value === 'string') {
      value = this.interpolate(config.value, context);
    } else {
      value = config.value;
    }

    context.variables[config.name] = value;

    return { name: config.name, value };
  }

  /**
   * 条件分支
   */
  private static async executeConditional(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      condition: string;
      operator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'regex';
      left?: string;
      right?: string;
      skipNext?: number; // 不满足条件时跳过接下来的N个action
    };

    let conditionMet = false;

    if (config.operator && config.left !== undefined && config.right !== undefined) {
      const left = this.interpolate(String(config.left), context);
      const right = this.interpolate(String(config.right), context);

      switch (config.operator) {
        case '==':
          conditionMet = left === right;
          break;
        case '!=':
          conditionMet = left !== right;
          break;
        case '>':
          conditionMet = Number(left) > Number(right);
          break;
        case '<':
          conditionMet = Number(left) < Number(right);
          break;
        case '>=':
          conditionMet = Number(left) >= Number(right);
          break;
        case '<=':
          conditionMet = Number(left) <= Number(right);
          break;
        case 'contains':
          conditionMet = left.includes(right);
          break;
        case 'regex':
          conditionMet = new RegExp(right).test(left);
          break;
      }
    } else {
      // 直接计算表达式
      const expr = this.interpolate(config.condition, context);
      try {
        // eslint-disable-next-line no-eval
        conditionMet = !!eval(expr);
      } catch {
        conditionMet = false;
      }
    }

    context.variables['_condition_result'] = conditionMet;

    return { conditionMet, skipNext: !conditionMet ? (config.skipNext || 0) : 0 };
  }

  /**
   * 延迟执行
   */
  private static async executeDelay(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      milliseconds?: number;
      seconds?: number;
    };

    const ms = config.milliseconds || (config.seconds || 1) * 1000;
    await new Promise(resolve => setTimeout(resolve, ms));

    return { delayed: ms };
  }

  /**
   * 随机回复
   */
  private static async executeRandomReply(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      // replies: 新版字段；messages: 兼容旧表单字段
      replies: Array<{
        content?: string;
        text?: string;
        template?: string;
        messageType?: 'text' | 'template';
      } | string>;
      messages?: Array<string | { content?: string; text?: string; template?: string; messageType?: 'text' | 'template' }>;
      messageType?: 'text' | 'template';
      saveAs?: string;
    };

    // 兼容 schema 使用的 messages 字段：如果 replies 为空而 messages 有值，则填充 replies
    if ((!config.replies || config.replies.length === 0) && config.messages && config.messages.length > 0) {
      config.replies = config.messages;
    }

    if (!config.replies || config.replies.length === 0) {
      throw new Error('No replies configured');
    }

    // 随机选择一个回复
    const randomReplyConfig = config.replies[Math.floor(Math.random() * config.replies.length)];
    
    // 标准化配置格式
    const replyConfig = typeof randomReplyConfig === 'string'
      ? { content: randomReplyConfig, messageType: config.messageType || 'text' }
      : { ...randomReplyConfig, messageType: randomReplyConfig.messageType || config.messageType || 'text' };

    // 如果只是保存到变量
    if (config.saveAs) {
      const content = replyConfig.content || replyConfig.text || replyConfig.template || '';
      context.variables[config.saveAs] = content;
      return { type: 'random_reply_save', saved: config.saveAs };
    }

    // 直接发送
    const message = this.buildMessage(replyConfig, context);
    const sendResult = await context.bot.reply(context.event, message);
    if (!sendResult.success) {
      throw new Error(sendResult.error || 'random_reply send failed');
    }
    return { type: 'random_reply', message, sendResult };
  }

  /**
   * 模板消息
   */
  private static async executeTemplateMessage(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      messageType?: 'text' | 'template' | 'segments';
      content?: string;
      text?: string;
      template?: string;
      segments?: Array<{
        type: 'text' | 'image' | 'at' | 'reply';
        data: Record<string, string>;
      }>;
      format?: 'plain' | 'markdown';
      saveAs?: string;
    };

    // 如果只是保存到变量
    if (config.saveAs) {
      const content = config.template || config.content || config.text || '';
      const interpolated = this.interpolate(content, context);
      context.variables[config.saveAs] = interpolated;
      return { type: 'template_message_save', saved: config.saveAs };
    }

    // 直接发送
    const message = this.buildMessage(config, context);
    const sendResult = await context.bot.reply(context.event, message);
    if (!sendResult.success) {
      throw new Error(sendResult.error || 'template_message send failed');
    }
    return { type: 'template_message', message, sendResult };
  }

  /**
   * 转发消息
   */
  private static async executeForwardMessage(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      targetType: 'private' | 'group';
      targetId: string;
      messageId?: string;
    };

    if (context.event.type !== 'message') {
      throw new Error('Can only forward message events');
    }

    const msgEvent = context.event as MessageEvent;
    const targetId = this.interpolate(config.targetId, context);
    
    // 转发原消息
    const sendResult = await context.bot.sendMessage(
      config.targetType === 'group' 
        ? { type: 'group', groupId: targetId }
        : { type: 'private', userId: targetId },
      msgEvent.content
    );

    if (!sendResult.success) {
      throw new Error(sendResult.error || 'forward_message failed');
    }

    return { type: 'forward_message', sendResult };
  }

  /**
   * 处理请求（好友/群）
   */
  private static async executeHandleRequest(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      approve: boolean;
      remark?: string;
      reason?: string;
    };

    if (context.event.type !== 'request') {
      throw new Error('Can only handle request events');
    }

    const reqEvent = context.event as RequestEvent;
    let success = false;

    if (reqEvent.subType === 'friend') {
      const remark = config.remark 
        ? this.interpolate(config.remark, context)
        : undefined;
      success = await context.bot.handleFriendRequest(reqEvent.flag, config.approve, remark);
    } else if (reqEvent.subType === 'group_invite' || reqEvent.subType === 'group_join') {
      const reason = config.reason 
        ? this.interpolate(config.reason, context)
        : undefined;
      success = await context.bot.handleGroupRequest(reqEvent.flag, config.approve, reason);
    }

    return { type: 'handle_request', success, approved: config.approve };
  }

  /**
   * 撤回消息
   */
  private static async executeRecallMessage(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      messageId?: string;
    };

    let messageId = config.messageId 
      ? this.interpolate(config.messageId, context)
      : undefined;

    // 从事件中获取消息ID
    if (!messageId && context.event.type === 'message') {
      messageId = (context.event as MessageEvent).messageId;
    }

    if (!messageId) {
      throw new Error('Message ID not found');
    }

    const success = await context.bot.recallMessage(messageId);

    return { type: 'recall_message', success, messageId };
  }

  /**
   * 提取数据（正则/JSONPath）
   */
  private static async executeExtractData(
    action: FlowAction,
    context: JobContext
  ): Promise<unknown> {
    const config = action.config as {
      source: string; // 从哪里提取（变量路径）
      type: 'regex' | 'jsonpath';
      pattern: string;
      saveAs: string;
      multiple?: boolean; // 是否提取所有匹配
    };

    const source = String(this.getValueByPath(context, config.source) || '');

    if (config.type === 'regex') {
      const regex = new RegExp(config.pattern, config.multiple ? 'g' : '');
      if (config.multiple) {
        const matches = [...source.matchAll(regex as RegExp)];
        const extracted = matches.map(m => m[1] || m[0]);
        context.variables[config.saveAs] = extracted;
        return { extracted, count: extracted.length };
      } else {
        const match = regex.exec(source);
        const extracted = match ? (match[1] || match[0]) : null;
        context.variables[config.saveAs] = extracted;
        return { extracted };
      }
    } else if (config.type === 'jsonpath') {
      // 简单的 JSONPath 支持（仅支持点号路径）
      try {
        const data = JSON.parse(source);
        const value = this.getValueByPath(data, config.pattern);
        context.variables[config.saveAs] = value;
        return { extracted: value };
      } catch (error) {
        throw new Error(`JSONPath extraction failed: ${error}`);
      }
    }

    return null;
  }

  /**
   * 字符串插值
   * 支持 ${variable} 语法
   */
  private static interpolate(template: string, context: JobContext): string {
    if (!template.includes('${')) {
      return template; // 无需插值
    }

    const originalTemplate = template;
    const result = template.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const value = this.getValueByPath(context, trimmedPath);
      const replacement = value !== undefined ? String(value) : '';
      console.debug('[Interpolate] Variable replacement', {
        variable: trimmedPath,
        found: value !== undefined,
        value: typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : String(value).substring(0, 100),
        replacement: replacement.substring(0, 100),
      });
      return replacement;
    });

    if (originalTemplate !== result) {
      console.debug('[Interpolate] Template changed', {
        before: originalTemplate.substring(0, 100),
        after: result.substring(0, 100),
      });
    }

    return result;
  }

  /**
   * 通过路径获取值
   * 支持从 context.variables 中获取变量
   */
  private static getValueByPath(obj: unknown, path: string): unknown {
    // 如果 obj 是 JobContext，先从 variables 中查找
    if (obj && typeof obj === 'object' && 'variables' in obj) {
      const context = obj as JobContext;
      const keys = path.split('.');
      
      // 先尝试从 context.variables 中获取
      if (keys[0] in context.variables) {
        let current = context.variables[keys[0]];
        for (let i = 1; i < keys.length; i++) {
          if (current === null || current === undefined) {
            return undefined;
          }
          current = (current as Record<string, unknown>)[keys[i]];
        }
        return current;
      }
    }

    const keys = path.split('.');
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }
}

/**
 * Flow 处理器
 */
export class FlowProcessor {
  private flows: Flow[] = [];
  private jobs: Map<string, Job> = new Map();
  private triggers: Map<string, Trigger> = new Map();

  /**
   * 设置 Trigger 列表
   */
  setTriggers(triggers: Trigger[]): void {
    this.triggers.clear();
    for (const trigger of triggers) {
      if (trigger.enabled) {
        this.triggers.set(trigger.id, trigger);
      }
    }
  }

  /**
   * 设置 Flow 列表
   */
  setFlows(flows: Flow[]): void {
    // 按优先级排序（数字越小优先级越高）
    this.flows = [...flows].sort((a, b) => a.priority - b.priority);
  }

  /**
   * 设置 Job 列表
   */
  setJobs(jobs: Job[]): void {
    this.jobs.clear();
    for (const job of jobs) {
      if (job.enabled) {
        this.jobs.set(job.id, job);
      }
    }
  }

  /**
   * 处理事件
   */
  async process(event: BotEvent, bot: Bot): Promise<FlowExecutionResult[]> {
    const results: FlowExecutionResult[] = [];

    // 获取匹配事件类型的 Flow
    const matchingFlows = this.flows.filter(
      (flow) => flow.enabled && flow.eventType === event.type
    );
    console.debug('[Flow] Matching flows', { eventType: event.type, count: matchingFlows.length });

    for (const flow of matchingFlows) {
      const result = await this.executeFlow(flow, event, bot);
      console.debug('[Flow] Flow executed', { 
        flowId: flow.id, 
        matched: result.matched, 
        executed: result.executed, 
        duration: result.duration, 
        error: result.error 
      });
      results.push(result);
    }

    return results;
  }

  /**
   * 执行单个 Flow
   */
  private async executeFlow(
    flow: Flow,
    event: BotEvent,
    bot: Bot
  ): Promise<FlowExecutionResult> {
    const startTime = Date.now();

    // 创建初始上下文（用于捕获匹配变量）
    const variables: Record<string, unknown> = {};

    // 检查是否有关联的触发器
    if (!flow.triggerIds || flow.triggerIds.length === 0) {
      console.warn('[Flow] No triggers associated', { flowId: flow.id });
      return {
        flowId: flow.id,
        matched: false,
        executed: false,
        jobs: [],
        error: 'No triggers associated with this flow',
        duration: Date.now() - startTime,
      };
    }

    console.debug('[Flow] Checking triggers', { flowId: flow.id, triggerIds: flow.triggerIds, triggersLoaded: this.triggers.size });

    // 检查是否至少有一个触发器匹配
    let triggerMatched = false;
    for (const triggerId of flow.triggerIds) {
      const trigger = this.triggers.get(triggerId);
      if (!trigger) {
        console.warn('[Flow] Trigger not found', { flowId: flow.id, triggerId });
        continue;
      }

      console.debug('[Flow] Testing trigger', { 
        flowId: flow.id, 
        triggerId, 
        triggerName: trigger.name,
        matchType: trigger.match.type,
        matchPattern: trigger.match.pattern,
        eventType: event.type,
        eventSubType: (event as any).subType,
        eventContent: this.getEventContent(event),
      });

      // 检查触发器的匹配规则
      const matchResult = Matcher.match(event, trigger.match, variables);
      console.debug('[Flow] Match result', { flowId: flow.id, triggerId, matched: matchResult });

      if (matchResult) {
        // 检查触发器的权限
        const permissionResult = PermissionChecker.check(event, trigger.permission);
        console.debug('[Flow] Permission result', { flowId: flow.id, triggerId, permitted: permissionResult });

        if (permissionResult) {
          triggerMatched = true;
          console.info('[Flow] Trigger matched', { flowId: flow.id, triggerId, triggerName: trigger.name });
          break; // 任何一个触发器匹配即可
        }
      }
    }

    if (!triggerMatched) {
      console.debug('[Flow] No trigger matched', { flowId: flow.id, triggerCount: flow.triggerIds.length });
      return {
        flowId: flow.id,
        matched: false,
        executed: false,
        jobs: [],
        duration: Date.now() - startTime,
      };
    }

    console.debug('[Flow] Matched', { flowId: flow.id, extractedVars: Object.keys(variables) });

    // 按顺序执行所有 Job
    const jobResults: JobResult[] = [];
    for (const jobId of flow.jobIds || []) {
      const job = this.jobs.get(jobId);
      if (!job) {
        console.warn('[Flow] Job not found', { flowId: flow.id, jobId });
        jobResults.push({
          jobId,
          executed: false,
          steps: [],
          error: `Job not found: ${jobId}`,
          duration: 0,
        });
        continue;
      }

      const jobResult = await this.executeJob(job, flow, event, bot, variables);
      jobResults.push(jobResult);

      // 如果 Job 执行失败且有错误，停止后续 Job（可选）
      if (!jobResult.executed && jobResult.error) {
        console.error('[Flow] Job failed, stopping flow', { flowId: flow.id, jobId, error: jobResult.error });
        return {
          flowId: flow.id,
          matched: true,
          executed: true,
          jobs: jobResults,
          error: `Job '${job.name}' failed: ${jobResult.error}`,
          duration: Date.now() - startTime,
        };
      }
    }

    return {
      flowId: flow.id,
      matched: true,
      executed: true,
      jobs: jobResults,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 获取事件的可读内容用于调试
   */
  private getEventContent(event: BotEvent): string {
    switch (event.type) {
      case 'message':
        return (event as MessageEvent).rawContent;
      case 'request':
        return (event as RequestEvent).comment || '(no comment)';
      case 'notice':
        return (event as NoticeEvent).subType;
      default:
        return '(unknown)';
    }
  }

  /**
   * 执行单个 Job
   */
  private async executeJob(
    job: Job,
    flow: Flow,
    event: BotEvent,
    bot: Bot,
    inheritedVariables: Record<string, unknown>
  ): Promise<JobResult> {
    const startTime = Date.now();
    console.debug('[Job] Start', { jobId: job.id, jobName: job.name, stepCount: job.steps.length });

    // 创建 Job 执行上下文
    const context: JobContext = {
      event,
      bot,
      flow,
      job,
      variables: { ...inheritedVariables },
      stepResults: [],
    };

    // 按顺序执行 Steps
    const sortedSteps = [...job.steps].sort((a, b) => a.order - b.order);

    for (const step of sortedSteps) {
      console.debug('[Step] Start', { jobId: job.id, stepId: step.id, stepName: step.name, stepType: step.type });
      const result = await StepExecutor.execute(step, context);
      console.debug('[Step] Done', { jobId: job.id, stepId: step.id, success: result.success, duration: result.duration, error: result.error });
      context.stepResults.push(result);

      // 如果 Step 执行失败，停止执行后续 Step
      if (!result.success) {
        console.error('[Step] Failed, stop job', { jobId: job.id, stepId: step.id, error: result.error });
        return {
          jobId: job.id,
          executed: true,
          steps: context.stepResults,
          error: `Step '${step.name}' failed: ${result.error}`,
          duration: Date.now() - startTime,
        };
      }
    }

    console.debug('[Job] Done', { jobId: job.id, stepCount: context.stepResults.length, duration: Date.now() - startTime });

    return {
      jobId: job.id,
      executed: true,
      steps: context.stepResults,
      duration: Date.now() - startTime,
    };
  }
}

// 全局 Flow 处理器实例
export const flowProcessor = new FlowProcessor();
