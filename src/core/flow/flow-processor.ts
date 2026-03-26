import type {
  BotEvent,
  MessageEvent,
  RequestEvent,
  NoticeEvent,
  Flow,
  Job,
  Trigger,
} from '@/types';
import { Bot } from '../bot';
import { Matcher } from './matcher';
import { PermissionChecker } from './permission-checker';
import { TriggerScopeChecker } from './trigger-scope-checker';
import { StepExecutor } from './step-executor';
import type { FlowExecutionResult, FlowPlatformRuntimeOptions, JobContext, JobResult } from './types';
import { shouldStopProcessingMoreFlows } from './flow-run-policy';
import { getPlatformSettings } from '@/lib/platform-settings';

/** 单次 process 使用的配置快照（无共享可变状态，适于 serverless 并发） */
export type FlowRuntimeSnapshot = {
  flows: Flow[];
  jobs: Job[];
  triggers: Trigger[];
};

type FlowRuntimeMaps = {
  flows: Flow[];
  triggerMap: Map<string, Trigger>;
  jobMap: Map<string, Job>;
};

function buildFlowRuntimeMaps(snapshot: FlowRuntimeSnapshot): FlowRuntimeMaps {
  const flows = [...snapshot.flows].sort((a, b) => a.priority - b.priority);
  const triggerMap = new Map<string, Trigger>();
  for (const t of snapshot.triggers) {
    if (t.enabled) triggerMap.set(t.id, t);
  }
  const jobMap = new Map<string, Job>();
  for (const j of snapshot.jobs) {
    if (j.enabled) jobMap.set(j.id, j);
  }
  return { flows, triggerMap, jobMap };
}

function tr(traceId: string | undefined): string {
  return traceId ? `[trace:${traceId}] ` : '';
}

/**
 * Flow 处理器（无实例级 flows/jobs/triggers；每次 process 传入快照）
 */
export class FlowProcessor {
  /**
   * @param snapshot 当前请求/事件对应的流程配置（与 Webhook Bot owner 一致）
   * @param options.traceId 全链路日志关联（如 x-request-id / 自生成 UUID）
   */
  async process(
    event: BotEvent,
    bot: Bot,
    snapshot: FlowRuntimeSnapshot,
    options?: { traceId?: string; flowDeadlineAt?: number }
  ): Promise<FlowExecutionResult[]> {
    const traceId = options?.traceId;
    const pl = await getPlatformSettings();
    const budgetMs = pl.flowProcessBudgetMs;
    const flowDeadlineAt =
      options?.flowDeadlineAt ??
      (Number.isFinite(budgetMs) && budgetMs > 0 ? Date.now() + budgetMs : undefined);
    const platform: FlowPlatformRuntimeOptions = {
      stopAfterFirstMatchGlobal: pl.flowStopAfterFirstMatch,
      callApiDefaultTimeoutMs: pl.callApiDefaultTimeoutMs,
      callApiMaxTimeoutMs: pl.callApiMaxTimeoutMs,
      llmAgentMaxToolRounds: pl.llmAgentMaxToolRounds,
    };
    const { flows, triggerMap, jobMap } = buildFlowRuntimeMaps(snapshot);
    const results: FlowExecutionResult[] = [];

    const matchingFlows = flows.filter((flow) => flow.enabled && flow.eventType === event.type);
    console.debug(`${tr(traceId)}[Flow] Matching flows`, { eventType: event.type, count: matchingFlows.length });

    const maps = { triggerMap, jobMap };
    for (const flow of matchingFlows) {
      const result = await this.executeFlow(flow, event, bot, maps, traceId, flowDeadlineAt, platform);
      console.debug(`${tr(traceId)}[Flow] Flow executed`, {
        flowId: flow.id,
        matched: result.matched,
        executed: result.executed,
        duration: result.duration,
        error: result.error,
      });
      results.push(result);
      if (shouldStopProcessingMoreFlows(result, flow, platform.stopAfterFirstMatchGlobal)) {
        console.debug(`${tr(traceId)}[Flow] Stop pipeline (halt lower-priority flows)`, {
          flowId: flow.id,
        });
        break;
      }
    }

    return results;
  }

  /**
   * 执行单个 Flow
   */
  private async executeFlow(
    flow: Flow,
    event: BotEvent,
    bot: Bot,
    maps: { triggerMap: Map<string, Trigger>; jobMap: Map<string, Job> },
    traceId?: string,
    flowDeadlineAt?: number,
    platform?: FlowPlatformRuntimeOptions,
  ): Promise<FlowExecutionResult> {
    const startTime = Date.now();

    if (flowDeadlineAt != null && Date.now() > flowDeadlineAt) {
      return {
        flowId: flow.id,
        matched: false,
        executed: false,
        jobs: [],
        error: 'Flow execution budget exceeded before start',
        duration: Date.now() - startTime,
      };
    }

    // 创建初始上下文（用于捕获匹配变量）
    const variables: Record<string, unknown> = {};

    // 检查是否有关联的触发器
    if (!flow.triggerIds || flow.triggerIds.length === 0) {
      console.warn(`${tr(traceId)}[Flow] No triggers associated`, { flowId: flow.id });
      return {
        flowId: flow.id,
        matched: false,
        executed: false,
        jobs: [],
        error: 'No triggers associated with this flow',
        duration: Date.now() - startTime,
      };
    }

    console.debug(`${tr(traceId)}[Flow] Checking triggers`, {
      flowId: flow.id,
      triggerIds: flow.triggerIds,
      triggersLoaded: maps.triggerMap.size,
    });

    // 检查是否至少有一个触发器匹配
    let triggerMatched = false;
    for (const triggerId of flow.triggerIds) {
      const trigger = maps.triggerMap.get(triggerId);
      if (!trigger) {
        console.warn(`${tr(traceId)}[Flow] Trigger not found`, { flowId: flow.id, triggerId });
        continue;
      }

      console.debug(`${tr(traceId)}[Flow] Testing trigger`, {
        flowId: flow.id, 
        triggerId, 
        triggerName: trigger.name,
        matchType: trigger.match.type,
        matchPattern: trigger.match.pattern,
        eventType: event.type,
        eventSubType: (event as any).subType,
        eventContent: this.getEventContent(event),
      });

      if (!TriggerScopeChecker.passes(event, bot, trigger.scope)) {
        console.debug(`${tr(traceId)}[Flow] Trigger scope skipped`, {
          flowId: flow.id,
          triggerId,
          platform: event.platform,
          botId: event.botId,
        });
        continue;
      }

      // 在独立副本上试匹配，避免「匹配成功但权限未过」时污染 variables（regex 捕获组等）
      const trialVars = { ...variables };
      const matchResult = Matcher.match(event, trigger.match, trialVars);
      console.debug(`${tr(traceId)}[Flow] Match result`, { flowId: flow.id, triggerId, matched: matchResult });

      if (matchResult) {
        const permissionResult = PermissionChecker.check(event, trigger.permission);
        console.debug(`${tr(traceId)}[Flow] Permission result`, {
          flowId: flow.id,
          triggerId,
          permitted: permissionResult,
        });

        if (permissionResult) {
          Object.assign(variables, trialVars);
          triggerMatched = true;
          console.info(`${tr(traceId)}[Flow] Trigger matched`, {
            flowId: flow.id,
            triggerId,
            triggerName: trigger.name,
          });
          break;
        }
      }
    }

    if (!triggerMatched) {
      console.debug(`${tr(traceId)}[Flow] No trigger matched`, {
        flowId: flow.id,
        triggerCount: flow.triggerIds.length,
      });
      return {
        flowId: flow.id,
        matched: false,
        executed: false,
        jobs: [],
        duration: Date.now() - startTime,
      };
    }

    console.debug(`${tr(traceId)}[Flow] Matched`, { flowId: flow.id, extractedVars: Object.keys(variables) });

    const targetKind = flow.targetKind === 'agent' ? 'agent' : 'job';

    if (targetKind === 'agent') {
      const agentId = flow.llmAgentId?.trim();
      if (!agentId) {
        return {
          flowId: flow.id,
          matched: true,
          executed: false,
          jobs: [],
          error: '流程已设为绑定 Agent，但未配置 Agent',
          duration: Date.now() - startTime,
        };
      }
      const pseudoJob = this.buildFlowInlineAgentJob(flow, agentId);
      const jobResult = await this.executeJob(
        pseudoJob,
        flow,
        event,
        bot,
        variables,
        traceId,
        flowDeadlineAt,
        platform,
      );
      return {
        flowId: flow.id,
        matched: true,
        executed: jobResult.executed,
        jobs: [jobResult],
        error: jobResult.error,
        duration: Date.now() - startTime,
      };
    }

    if (!flow.jobIds?.length) {
      return {
        flowId: flow.id,
        matched: true,
        executed: false,
        jobs: [],
        error: '流程未关联任何步骤流水线',
        duration: Date.now() - startTime,
      };
    }

    // 按顺序执行所有 Job
    const jobResults: JobResult[] = [];
    for (const jobId of flow.jobIds || []) {
      const job = maps.jobMap.get(jobId);
      if (!job) {
        console.warn(`${tr(traceId)}[Flow] Job not found`, { flowId: flow.id, jobId });
        jobResults.push({
          jobId,
          executed: false,
          steps: [],
          error: `Job not found: ${jobId}`,
          duration: 0,
        });
        continue;
      }

      const jobResult = await this.executeJob(job, flow, event, bot, variables, traceId, flowDeadlineAt, platform);
      jobResults.push(jobResult);

      // 如果 Job 执行失败且有错误，停止后续 Job（可选）
      if (!jobResult.executed && jobResult.error) {
        console.error(`${tr(traceId)}[Flow] Job failed, stopping flow`, {
          flowId: flow.id,
          jobId,
          error: jobResult.error,
        });
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
   * 流程直接绑定 Agent 时使用的内存 Job：单步 llm_agent，用户提示由事件内容插值
   */
  private buildFlowInlineAgentJob(flow: Flow, agentId: string): Job {
    const now = Date.now();
    return {
      id: `__flow_agent:${flow.id}`,
      name: `流程内 Agent · ${flow.name}`,
      enabled: true,
      steps: [
        {
          id: `llm_agent_inline_${flow.id}`,
          type: 'llm_agent',
          name: 'LLM Agent',
          order: 0,
          config: {
            agentId,
            userPrompt:
              '${event.type === "message" ? event.rawContent : event.type === "request" ? (event.comment || "") : String(event.subType || "")}',
            saveAs: 'llmReply',
          },
        },
      ],
      createdAt: now,
      updatedAt: now,
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
    inheritedVariables: Record<string, unknown>,
    traceId?: string,
    flowDeadlineAt?: number,
    platform?: FlowPlatformRuntimeOptions,
  ): Promise<JobResult> {
    const startTime = Date.now();
    console.debug(`${tr(traceId)}[Job] Start`, { jobId: job.id, jobName: job.name, stepCount: job.steps.length });

    // 创建 Job 执行上下文
    const context: JobContext = {
      event,
      bot,
      flow,
      job,
      variables: { ...inheritedVariables },
      stepResults: [],
      flowDeadlineAt,
      platform,
    };

    // 按顺序执行 Steps
    const sortedSteps = [...job.steps].sort((a, b) => a.order - b.order);

    let skipNextCount = 0;
    for (const step of sortedSteps) {
      if (skipNextCount > 0) {
        skipNextCount--;
        console.debug(`${tr(traceId)}[Step] Skipped (conditional skipNext)`, { jobId: job.id, stepId: step.id });
        continue;
      }

      if (flowDeadlineAt != null && Date.now() > flowDeadlineAt) {
        console.warn(`${tr(traceId)}[Step] Budget exceeded`, { jobId: job.id, stepId: step.id });
        return {
          jobId: job.id,
          executed: true,
          steps: context.stepResults,
          error: 'Flow execution budget exceeded',
          duration: Date.now() - startTime,
        };
      }

      console.debug(`${tr(traceId)}[Step] Start`, {
        jobId: job.id,
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
      });
      const result = await StepExecutor.execute(step, context);
      console.debug(`${tr(traceId)}[Step] Done`, {
        jobId: job.id,
        stepId: step.id,
        success: result.success,
        duration: result.duration,
        error: result.error,
      });
      context.stepResults.push(result);

      // 如果 Step 执行失败，停止执行后续 Step
      if (!result.success) {
        console.error(`${tr(traceId)}[Step] Failed, stop job`, {
          jobId: job.id,
          stepId: step.id,
          error: result.error,
        });
        return {
          jobId: job.id,
          executed: true,
          steps: context.stepResults,
          error: `Step '${step.name}' failed: ${result.error}`,
          duration: Date.now() - startTime,
        };
      }

      if (step.type === 'conditional' && result.data && typeof result.data === 'object') {
        const sn = (result.data as { skipNext?: unknown }).skipNext;
        if (typeof sn === 'number' && sn > 0) {
          skipNextCount = sn;
        }
      }
    }

    console.debug(`${tr(traceId)}[Job] Done`, {
      jobId: job.id,
      stepCount: context.stepResults.length,
      duration: Date.now() - startTime,
    });

    return {
      jobId: job.id,
      executed: true,
      steps: context.stepResults,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 定时任务等：不经过 Flow/触发器匹配，直接用合成事件执行 Job 的步骤序列（与 executeJob 同源）。
   */
  async runStandaloneJob(
    job: Job,
    bot: Bot,
    event: BotEvent,
    options?: {
      traceId?: string;
      flowDeadlineAt?: number;
      variables?: Record<string, unknown>;
    },
  ): Promise<JobResult> {
    const now = Date.now();
    const pseudoFlow: Flow = {
      id: '__scheduled_task__',
      name: '定时任务',
      description: undefined,
      enabled: true,
      eventType: event.type,
      priority: 0,
      triggerIds: [],
      targetKind: 'job',
      llmAgentId: null,
      jobIds: [job.id],
      haltLowerPriorityAfterMatch: false,
      ownerId: job.ownerId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const pl = await getPlatformSettings();
    const platform: FlowPlatformRuntimeOptions = {
      stopAfterFirstMatchGlobal: pl.flowStopAfterFirstMatch,
      callApiDefaultTimeoutMs: pl.callApiDefaultTimeoutMs,
      callApiMaxTimeoutMs: pl.callApiMaxTimeoutMs,
      llmAgentMaxToolRounds: pl.llmAgentMaxToolRounds,
    };
    return this.executeJob(
      job,
      pseudoFlow,
      event,
      bot,
      options?.variables ?? {},
      options?.traceId,
      options?.flowDeadlineAt,
      platform,
    );
  }
}

// 全局 Flow 处理器实例
export const flowProcessor = new FlowProcessor();
