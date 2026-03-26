import { describe, it, expect } from 'vitest';
import { evaluateExpression, interpolate } from './step-template';
import type { JobContext } from './types';
import type { BotEvent, Flow, Job } from '@/types';

function minimalContext(vars: Record<string, unknown>): JobContext {
  const event = {
    id: 'e1',
    type: 'message',
    platform: 't',
    botId: 'b1',
    timestamp: 0,
    rawContent: '',
    subType: 'private',
    content: [],
    messageId: 'm1',
    sender: { userId: 'u1', role: 'normal' as const },
  } as BotEvent;
  return {
    event,
    bot: { id: 'b', platform: 't', name: 'n' } as unknown as JobContext['bot'],
    flow: { id: 'f' } as unknown as Flow,
    job: { id: 'j', name: 'j', enabled: true, steps: [], createdAt: 0, updatedAt: 0 } as Job,
    variables: vars,
    stepResults: [],
  };
}

describe('step-template', () => {
  it('evaluateExpression 可做基本算术（与原先 eval 路径一致）', () => {
    const ctx = minimalContext({ a: 2 });
    expect(evaluateExpression('a + 3', ctx)).toBe(5);
  });

  it('interpolate 替换变量', () => {
    const ctx = minimalContext({ name: 'bob' });
    expect(interpolate('hi ${name}', ctx)).toBe('hi bob');
  });
});
