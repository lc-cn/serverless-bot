import { z } from 'zod';

// ==================== 用户相关类型 ====================
export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: UserRole;
}

export type UserRole = 'normal' | 'admin' | 'owner';

export interface UserDetail extends User {
  nickname?: string;
  email?: string;
  phone?: string;
  extra?: Record<string, unknown>;
}

// ==================== 群组相关类型 ====================
export interface Group {
  id: string;
  name: string;
  avatar?: string;
  memberCount?: number;
}

export interface GroupDetail extends Group {
  description?: string;
  ownerId?: string;
  admins?: string[];
  extra?: Record<string, unknown>;
}

// ==================== 消息相关类型 ====================
export type MessageSegmentType = 
  | 'text' 
  | 'image' 
  | 'audio' 
  | 'video' 
  | 'file' 
  | 'at' 
  | 'reply' 
  | 'face'
  | 'location'
  | 'share'
  | 'custom';

export interface MessageSegment {
  type: MessageSegmentType;
  data: Record<string, unknown>;
}

export interface TextSegment extends MessageSegment {
  type: 'text';
  data: { text: string };
}

export interface ImageSegment extends MessageSegment {
  type: 'image';
  data: { url: string; file?: string };
}

export interface AtSegment extends MessageSegment {
  type: 'at';
  data: { userId: string; name?: string };
}

export interface ReplySegment extends MessageSegment {
  type: 'reply';
  data: { messageId: string };
}

export type Message = MessageSegment[];

// ==================== 发送结果 ====================
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ==================== 事件相关类型 ====================
export type EventType = 'message' | 'request' | 'notice';

export type MessageEventSubType = 'private' | 'group';

export type RequestEventSubType = 
  | 'friend' 
  | 'group_invite' 
  | 'group_join';

export type NoticeEventSubType = 
  | 'group_member_increase' 
  | 'group_member_decrease' 
  | 'group_admin_change'
  | 'group_ban'
  | 'friend_add'
  | 'poke'
  | 'custom';

export interface BaseEvent {
  id: string;
  type: EventType;
  subType: string;
  platform: string;
  botId: string;
  timestamp: number;
  sender: {
    userId: string;
    nickname?: string;
    role: UserRole;
  };
  raw?: unknown;
}

export interface MessageEvent extends BaseEvent {
  type: 'message';
  subType: MessageEventSubType;
  content: Message;
  rawContent: string;
  groupId?: string;
  messageId: string;
}

export interface RequestEvent extends BaseEvent {
  type: 'request';
  subType: RequestEventSubType;
  comment?: string;
  flag: string;
  groupId?: string;
}

export interface NoticeEvent extends BaseEvent {
  type: 'notice';
  subType: NoticeEventSubType;
  groupId?: string;
  operatorId?: string;
  targetId?: string;
  extra?: Record<string, unknown>;
}

export type BotEvent = MessageEvent | RequestEvent | NoticeEvent;

// ==================== 发送目标 ====================
export interface SendTarget {
  type: 'private' | 'group';
  userId?: string;
  groupId?: string;
}

// ==================== Flow 相关类型 ====================
export type FlowEventType = 'message' | 'request' | 'notice';

export type MatchType = 
  | 'exact'       // 精确匹配
  | 'keyword'     // 关键词匹配
  | 'prefix'      // 前缀匹配
  | 'suffix'      // 后缀匹配
  | 'contains'    // 包含匹配
  | 'regex'       // 正则匹配
  | 'always';     // 总是匹配

export interface MatchRule {
  type: MatchType;
  pattern: string;
  ignoreCase?: boolean;
}

export interface PermissionRule {
  allowRoles: UserRole[];
  allowEnvironments: ('private' | 'group')[];
  allowGroups?: string[];
  allowUsers?: string[];
  denyGroups?: string[];
  denyUsers?: string[];
}

// ==================== Trigger 触发器 ====================
export interface Trigger {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  eventType: FlowEventType;
  match: MatchRule;
  permission: PermissionRule;
  createdAt: number;
  updatedAt: number;
}

export type StepType = 
  | 'call_api'         // 调用外部 API
  | 'call_bot'         // 调用 Bot 方法
  | 'send_message'     // 发送消息
  | 'hardcode'         // 硬编码内容
  | 'log'              // 记录日志
  | 'get_user_info'    // 获取用户信息
  | 'get_group_info'   // 获取群组信息
  | 'set_variable'     // 设置变量
  | 'conditional'      // 条件分支
  | 'delay'            // 延迟执行
  | 'random_reply'     // 随机回复
  | 'template_message' // 模板消息
  | 'forward_message'  // 转发消息
  | 'handle_request'   // 处理请求（好友/群）
  | 'recall_message'   // 撤回消息
  | 'extract_data';    // 提取数据（正则/JSONPath）

export interface Step {
  id: string;
  type: StepType;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  order: number;
}

// 向后兼容：旧版 Flow 使用 FlowAction 表示步骤
export type FlowAction = Step;

export interface Job {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  steps: Step[];
  createdAt: number;
  updatedAt: number;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  eventType: FlowEventType; // 事件类型（用于管理和筛选）
  triggerIds: string[]; // 关联的触发器 ID 列表（满足任一触发器即可触发）
  priority: number;
  jobIds: string[]; // 关联的 Job ID 列表（按顺序执行）
  createdAt: number;
  updatedAt: number;
  // 兼容旧版字段（用于一些 UI 组件）：
  permission?: PermissionRule;
  match?: MatchRule;
  actions?: FlowAction[];
}

// 向后兼容：保留旧的 Flow 格式
export interface LegacyFlow extends Omit<Flow, 'triggerIds'> {
  eventType: FlowEventType;
  permission: PermissionRule;
  match: MatchRule;
  triggerIds?: never;
}

// ==================== Bot 配置 ====================
export interface BotConfig {
  id: string;
  platform: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// ==================== Adapter 配置 ====================
export interface AdapterConfig {
  platform: string;
  name: string;
  description?: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// ==================== Zod Schemas ====================
export const UserRoleSchema = z.enum(['normal', 'admin', 'owner']);

export const MatchTypeSchema = z.enum([
  'exact', 'keyword', 'prefix', 'suffix', 'contains', 'regex', 'always'
]);

export const MatchRuleSchema = z.object({
  type: MatchTypeSchema,
  pattern: z.string(),
  ignoreCase: z.boolean().optional(),
});

export const PermissionRuleSchema = z.object({
  allowRoles: z.array(UserRoleSchema),
  allowEnvironments: z.array(z.enum(['private', 'group'])),
  allowGroups: z.array(z.string()).optional(),
  allowUsers: z.array(z.string()).optional(),
  denyGroups: z.array(z.string()).optional(),
  denyUsers: z.array(z.string()).optional(),
});

export const StepTypeSchema = z.enum([
  'call_api', 'call_bot', 'send_message', 'hardcode', 'log',
  'get_user_info', 'get_group_info', 'set_variable', 'conditional',
  'delay', 'random_reply', 'template_message', 'forward_message',
  'handle_request', 'recall_message', 'extract_data'
]);

export const StepSchema = z.object({
  id: z.string(),
  type: StepTypeSchema,
  name: z.string(),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()),
  order: z.number(),
});

export const JobSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  steps: z.array(StepSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const FlowEventTypeSchema = z.enum(['message', 'request', 'notice']);

export const TriggerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  eventType: FlowEventTypeSchema,
  match: MatchRuleSchema,
  permission: PermissionRuleSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const FlowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  eventType: z.enum(['message', 'request', 'notice']),
  triggerIds: z.array(z.string()),
  priority: z.number(),
  jobIds: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const BotConfigSchema = z.object({
  id: z.string(),
  platform: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const AdapterConfigSchema = z.object({
  platform: z.string(),
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
  updatedAt: z.number(),
});
