import type { BotEvent, Flow, Job } from '@/types';
import type { Bot } from '../bot';

/** 来自 platform_settings，注入 Job 供步骤读取（call_api、llm_agent 等） */
export interface FlowPlatformRuntimeOptions {
  stopAfterFirstMatchGlobal: boolean;
  callApiDefaultTimeoutMs: number;
  callApiMaxTimeoutMs: number | null;
  llmAgentMaxToolRounds: number;
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
  /** 绝对时间戳（ms）；若设置，步骤开始前与 delay 会尊重剩余时间 */
  flowDeadlineAt?: number;
  /** 平台级运行时参数（FlowProcessor 从数据库注入） */
  platform?: FlowPlatformRuntimeOptions;
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
