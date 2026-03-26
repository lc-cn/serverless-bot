import type { Flow } from '@/types';
import type { FlowExecutionResult } from './types';

/**
 * 当前 flow 执行完后是否停止处理同事件中其余 flows（按 priority 已排序的列表中「更低的」项）。
 * - globalStopAfterFirstMatch：来自 platform_settings.flowStopAfterFirstMatch，任意 flow 一旦 matched 即停止
 * - 否则仅当该 flow 配置 haltLowerPriorityAfterMatch 为 true 且本轮 matched 时停止
 */
export function shouldStopProcessingMoreFlows(
  result: FlowExecutionResult,
  flow: Flow,
  globalStopAfterFirstMatch = false,
): boolean {
  if (!result.matched) return false;
  if (globalStopAfterFirstMatch) return true;
  return flow.haltLowerPriorityAfterMatch === true;
}
