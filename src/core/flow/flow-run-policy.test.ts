import { describe, it, expect } from 'vitest';
import type { Flow } from '@/types';
import { shouldStopProcessingMoreFlows } from './flow-run-policy';
import type { FlowExecutionResult } from './types';

const baseFlow = { id: 'f1' } as Flow;

function result(matched: boolean): FlowExecutionResult {
  return {
    flowId: 'f1',
    matched,
    executed: false,
    jobs: [],
    duration: 0,
  };
}

describe('shouldStopProcessingMoreFlows', () => {
  it('未匹配时不停止', () => {
    expect(shouldStopProcessingMoreFlows(result(false), baseFlow)).toBe(false);
    expect(
      shouldStopProcessingMoreFlows(result(false), {
        ...baseFlow,
        haltLowerPriorityAfterMatch: true,
      })
    ).toBe(false);
  });

  it('平台级 globalStopAfterFirstMatch 时匹配即停', () => {
    expect(shouldStopProcessingMoreFlows(result(true), baseFlow, true)).toBe(true);
  });

  it('流程配置 haltLowerPriorityAfterMatch 且匹配时停止', () => {
    expect(
      shouldStopProcessingMoreFlows(result(true), {
        ...baseFlow,
        haltLowerPriorityAfterMatch: true,
      })
    ).toBe(true);
    expect(
      shouldStopProcessingMoreFlows(result(true), {
        ...baseFlow,
        haltLowerPriorityAfterMatch: false,
      })
    ).toBe(false);
  });
});
