import type { Job, Step } from '@/types';
import type { JobContext, StepResult } from './types';

/**
 * 模型 function 调用时执行工具自带步骤；参数合并进变量。
 * 将返回模型的内容写入 **toolResult**，否则序列化最后一步 data。
 */
export async function runToolImplementationSteps(
  executeStep: (step: Step, context: JobContext) => Promise<StepResult>,
  steps: Step[],
  parentContext: JobContext,
  toolArgs: Record<string, unknown>
): Promise<{ ok: boolean; payload: string }> {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const pseudoJob: Job = {
    id: '__llm_tool__',
    name: 'LLM Tool',
    description: undefined,
    enabled: true,
    steps: sorted,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const subContext: JobContext = {
    ...parentContext,
    job: pseudoJob,
    variables: { ...parentContext.variables, ...toolArgs },
    stepResults: [],
  };
  let skipNextCount = 0;
  for (const step of sorted) {
    if (skipNextCount > 0) {
      skipNextCount--;
      continue;
    }
    const result = await executeStep(step, subContext);
    subContext.stepResults.push(result);
    if (!result.success) {
      return {
        ok: false,
        payload: JSON.stringify({ error: result.error || 'step failed' }),
      };
    }
    if (step.type === 'conditional' && result.data && typeof result.data === 'object') {
      const sn = (result.data as { skipNext?: unknown }).skipNext;
      if (typeof sn === 'number' && sn > 0) {
        skipNextCount = sn;
      }
    }
  }
  const tr = subContext.variables.toolResult;
  if (tr !== undefined && tr !== null) {
    const payload = typeof tr === 'string' ? tr : JSON.stringify(tr);
    return { ok: true, payload };
  }
  const last = subContext.stepResults[subContext.stepResults.length - 1];
  return {
    ok: true,
    payload: JSON.stringify(last?.data ?? null),
  };
}
