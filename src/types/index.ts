import { z } from 'zod';

/** 安装门禁阶段（proxy + `/install` / `/upgrade`）；逻辑见 `getInstallPhase` */
export type InstallPhase = 'no_database' | 'needs_install' | 'needs_upgrade' | 'installed';

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

/** 流程执行目标：按顺序执行步骤流水线（Job），或直接调用一个 LLM Agent */
export type FlowTargetKind = 'job' | 'agent';

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

/** 适配器约束：与事件上的 platform、botId 对齐（空列表表示不启用该条规则） */
export interface TriggerAdapterScope {
  allowPlatforms?: string[];
  denyPlatforms?: string[];
  allowBotIds?: string[];
  denyBotIds?: string[];
}

/** 事件子类型（如 notice 的 group_ban、message 的 private/group） */
export interface TriggerEventScope {
  allowSubTypes?: string[];
  denySubTypes?: string[];
}

/**
 * 触发器范围：在「内容匹配」之前判定。
 * - adapter：限制平台与机器人实例
 * - event：限制 subType（黑白名单）
 */
export interface TriggerScope {
  adapter?: TriggerAdapterScope;
  event?: TriggerEventScope;
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
  /** 适配器 / 事件子类型等约束；未设置表示不限制 */
  scope?: TriggerScope;
  /** 创建者；NULL 表示全局（所有登录用户可见，Webhook 对所有 Bot 生效） */
  ownerId?: string | null;
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
  | 'extract_data'     // 提取数据（正则/JSONPath）
  | 'llm_agent'        // 使用已配置的 LLM Agent 对话
  | 'parse_json'       // 将 JSON 文本解析为对象（工具链常用）
  | 'stringify_json'   // 将变量序列化为 JSON 字符串（便于写入 toolResult）
  | 'base64_encode'    // UTF-8 文本 → Base64
  | 'base64_decode'    // Base64 → UTF-8 文本
  | 'url_encode'       // URI 组件编码
  | 'url_decode';      // URI 组件解码

/** LLM 厂商连接：一套 endpoint + 密钥，下挂多个预置模型 */
export interface LlmVendorProfile {
  id: string;
  ownerId: string;
  vendorKind: string;
  name: string;
  apiBaseUrl: string;
  /** 高级参数 JSON，如 {"http":{...}} 定制鉴权与请求体 */
  extraJson?: string | null;
  createdAt: string;
  updatedAt: string;
  hasApiKey: boolean;
}

/** 厂商下预置的 API 模型名（Agent 可引用，变更密钥只需改 Profile） */
export interface LlmVendorModel {
  id: string;
  ownerId: string;
  profileId: string;
  modelId: string;
  displayName?: string;
  extraJson?: string | null;
  createdAt: string;
  updatedAt: string;
  /** 列表接口可选附带 */
  profileName?: string;
  vendorKind?: string;
}

/** MCP 服务（Streamable HTTP 远端；Agent 可选关联，运行时 listTools 合并进模型） */
export interface LlmMcpServer {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  /** 当前实现：streamable_http */
  transport: string;
  createdAt: string;
  updatedAt: string;
  /** 是否配置了自定义请求头（常含 Authorization） */
  hasHeaders: boolean;
}

/** 持久化的 LLM Agent（控制台管理） */
export interface LlmAgent {
  id: string;
  ownerId: string;
  vendorKind: string;
  name: string;
  apiBaseUrl: string;
  defaultModel: string;
  /** 若设置，运行时从厂商模型解析 endpoint/密钥/模型名（Profile 侧更新即时生效） */
  configuredModelId?: string | null;
  /** 列表/详情展示用，如「OpenAI 生产 / gpt-4o-mini」 */
  configuredModelSummary?: string;
  presetSystemPrompt?: string;
  extraJson?: string | null;
  /** 关联的技能 ID（多对多） */
  skillIds: string[];
  /** 关联的工具 ID（多对多） */
  toolIds: string[];
  /** 关联的 MCP 服务 ID（多对多） */
  mcpServerIds: string[];
  createdAt: string;
  updatedAt: string;
  /** 列表/详情 API 使用，不返回密钥 */
  hasApiKey: boolean;
}

/** LLM 技能：注入系统提示的文本块 */
export interface LlmSkill {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** LLM 工具：OpenAI tools 单项 + 自带实现步骤（与事件路由中的步骤流水线无关） */
export interface LlmTool {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  definitionJson: string;
  /** 详情接口返回；模型 function 参数会并入步骤上下文变量 */
  steps?: Step[];
  /** 列表接口附带 */
  stepCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Step {
  id: string;
  type: StepType;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  order: number;
}

/** Job / Flow 引擎中的单步配置（与 steps 表结构一致） */
export type FlowAction = Step;

export interface Job {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  steps: Step[];
  ownerId?: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 定时任务：Cron + 已有 Job（步骤序列）+ Bot，由内部 tick 触发执行 */
export interface ScheduledTask {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  ownerId: string;
  jobId: string;
  botId: string;
  /** 五段 UNIX Cron：分 时 日 月 周（与 cron-parser 一致） */
  cronExpr: string;
  /** IANA 时区，如 Asia/Shanghai；UTC 可写 UTC */
  timezone: string;
  lastRunAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** 单次定时触发执行记录（由 /api/internal/cron/tick 写入） */
export interface ScheduledTaskRun {
  id: string;
  taskId: string;
  ownerId: string;
  traceId?: string;
  startedAt: number;
  finishedAt: number | null;
  outcome: 'running' | 'ok' | 'error';
  errorMessage?: string;
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  eventType: FlowEventType; // 事件类型（用于管理和筛选）
  triggerIds: string[]; // 关联的触发器 ID 列表（满足任一触发器即可触发）
  priority: number;
  /** 默认 job：按 jobIds 执行；agent 时仅执行 llmAgentId 对应的 Agent */
  targetKind?: FlowTargetKind;
  /** targetKind 为 agent 时必填（存储层可空，校验在 Schema/API） */
  llmAgentId?: string | null;
  jobIds: string[]; // 关联的 Job ID 列表（按顺序执行）
  /**
   * 为 true 时：本流程一旦匹配成功，同事件中不再执行本轮尚未运行的其它流程（与引擎按 priority 升序执行一致）。
   * 全局可被 FLOW_STOP_AFTER_FIRST_MATCH=1 设为任意流程首个匹配后即停。
   */
  haltLowerPriorityAfterMatch?: boolean;
  ownerId?: string | null;
  createdAt: number;
  updatedAt: number;
}

// ==================== Bot 配置 ====================
export interface BotConfig {
  id: string;
  platform: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  ownerId?: string; // 创建者用户ID，用于数据隔离
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

export const TriggerScopeSchema = z
  .object({
    adapter: z
      .object({
        allowPlatforms: z.array(z.string()).optional(),
        denyPlatforms: z.array(z.string()).optional(),
        allowBotIds: z.array(z.string()).optional(),
        denyBotIds: z.array(z.string()).optional(),
      })
      .optional(),
    event: z
      .object({
        allowSubTypes: z.array(z.string()).optional(),
        denySubTypes: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .optional();

export const StepTypeSchema = z.enum([
  'call_api', 'call_bot', 'send_message', 'hardcode', 'log',
  'get_user_info', 'get_group_info', 'set_variable', 'conditional',
  'delay', 'random_reply', 'template_message', 'forward_message',
  'handle_request', 'recall_message', 'extract_data', 'llm_agent',
  'parse_json', 'stringify_json', 'base64_encode', 'base64_decode', 'url_encode', 'url_decode',
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
  ownerId: z.string().nullable().optional(),
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
  scope: TriggerScopeSchema,
  ownerId: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const FlowTargetKindSchema = z.enum(['job', 'agent']);

export const FlowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    enabled: z.boolean(),
    eventType: z.enum(['message', 'request', 'notice']),
    triggerIds: z.array(z.string()),
    priority: z.number(),
    targetKind: FlowTargetKindSchema.default('job'),
    llmAgentId: z.string().nullable().optional(),
    jobIds: z.array(z.string()),
    haltLowerPriorityAfterMatch: z.boolean().optional(),
    ownerId: z.string().nullable().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .superRefine((data, ctx) => {
    const kind = data.targetKind ?? 'job';
    if (kind === 'job') {
      if (!data.jobIds?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '绑定步骤流水线时须至少选择一条流水线',
          path: ['jobIds'],
        });
      }
    } else if (!String(data.llmAgentId ?? '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '绑定 Agent 时须选择一个 Agent',
        path: ['llmAgentId'],
      });
    }
  });

export const BotConfigSchema = z.object({
  id: z.string(),
  platform: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  ownerId: z.string().optional(),
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
