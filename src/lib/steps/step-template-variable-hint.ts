import type { StepType } from '@/types';

/**
 * 与 `interpolate` / `evaluateExpression`（见 core/flow/step-template.ts）一致的可用符号。
 * 用于步骤配置 UI：发送消息、硬编码回复、随机回复、模板消息等。
 */
export const STEP_TYPES_WITH_FLOW_TEMPLATE_HINT: readonly StepType[] = [
  'send_message',
  'hardcode',
  'random_reply',
  'template_message',
];

export function stepTypeShowsFlowTemplateHint(type: StepType | undefined): boolean {
  return type !== undefined && STEP_TYPES_WITH_FLOW_TEMPLATE_HINT.includes(type);
}
