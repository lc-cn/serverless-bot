import { describe, it, expect } from 'vitest';
import { Matcher } from './matcher';
import type { BotEvent, MatchRule } from '@/types';

/** 模拟 flow-processor：仅在「匹配且权限通过」时合并 trial 变量 */
function tryTriggerMatch(
  variables: Record<string, unknown>,
  _event: BotEvent,
  rule: MatchRule,
  permissionOk: boolean
): boolean {
  const trialVars = { ...variables };
  const matched = Matcher.match(_event, rule, trialVars);
  if (matched && permissionOk) {
    Object.assign(variables, trialVars);
    return true;
  }
  return false;
}

describe('Matcher + trial variables', () => {
  it('匹配失败但权限通过时不合并捕获组', () => {
    const variables: Record<string, unknown> = { keep: 1 };
    const event = {
      id: 'e1',
      type: 'message',
      platform: 't',
      botId: 'b1',
      timestamp: 0,
      rawContent: 'hello world',
      subType: 'private',
      content: [],
      messageId: 'm1',
      sender: { userId: 'u1', role: 'normal' as const },
    } as BotEvent;
    const rule: MatchRule = {
      type: 'regex',
      pattern: '(\\w+)',
      ignoreCase: false,
    };
    expect(tryTriggerMatch(variables, event, rule, false)).toBe(false);
    expect(variables.keep).toBe(1);
    expect(variables.match_1).toBeUndefined();
  });

  it('匹配且通过后合并捕获组', () => {
    const variables: Record<string, unknown> = {};
    const event = {
      id: 'e1',
      type: 'message',
      platform: 't',
      botId: 'b1',
      timestamp: 0,
      rawContent: 'abc',
      subType: 'private',
      content: [],
      messageId: 'm1',
      sender: { userId: 'u1', role: 'normal' as const },
    } as BotEvent;
    const rule: MatchRule = {
      type: 'regex',
      pattern: '(\\w+)',
      ignoreCase: false,
    };
    expect(tryTriggerMatch(variables, event, rule, true)).toBe(true);
    expect(variables.match_1).toBe('abc');
  });

  it('先权限失败再试下一规则时，主 variables 无脏残留', () => {
    const variables: Record<string, unknown> = {};
    const event = {
      id: 'e1',
      type: 'message',
      platform: 't',
      botId: 'b1',
      timestamp: 0,
      rawContent: 'xy',
      subType: 'private',
      content: [],
      messageId: 'm1',
      sender: { userId: 'u1', role: 'normal' as const },
    } as BotEvent;
    const r1: MatchRule = { type: 'regex', pattern: '(x)(y)', ignoreCase: false };
    expect(tryTriggerMatch(variables, event, r1, false)).toBe(false);
    expect(variables.match_1).toBeUndefined();

    const r2: MatchRule = { type: 'regex', pattern: '(x)y', ignoreCase: false };
    expect(tryTriggerMatch(variables, event, r2, true)).toBe(true);
    expect(variables.match_1).toBe('x');
  });
});
