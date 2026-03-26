import type { FlowAction } from '@/types';
import type { JobContext } from '../types';
import { evaluateExpression, interpolate } from '../step-template';

export async function executeSetVariable(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    name: string;
    value: unknown;
    expression?: string;
  };

  let value: unknown;

  if (config.expression) {
    const expr = interpolate(config.expression, context);
    try {
      value = evaluateExpression(expr, context);
    } catch {
      value = expr;
    }
  } else if (typeof config.value === 'string') {
    value = interpolate(config.value, context);
  } else {
    value = config.value;
  }

  context.variables[config.name] = value;

  return { name: config.name, value };
}

export async function executeConditional(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    condition: string;
    operator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'regex';
    left?: string;
    right?: string;
    skipNext?: number;
  };

  let conditionMet = false;

  if (config.operator && config.left !== undefined && config.right !== undefined) {
    const left = interpolate(String(config.left), context);
    const right = interpolate(String(config.right), context);

    switch (config.operator) {
      case '==':
        conditionMet = left === right;
        break;
      case '!=':
        conditionMet = left !== right;
        break;
      case '>':
        conditionMet = Number(left) > Number(right);
        break;
      case '<':
        conditionMet = Number(left) < Number(right);
        break;
      case '>=':
        conditionMet = Number(left) >= Number(right);
        break;
      case '<=':
        conditionMet = Number(left) <= Number(right);
        break;
      case 'contains':
        conditionMet = left.includes(right);
        break;
      case 'regex':
        conditionMet = new RegExp(right).test(left);
        break;
    }
  } else {
    const expr = interpolate(config.condition, context);
    try {
      conditionMet = Boolean(evaluateExpression(expr, context));
    } catch {
      conditionMet = false;
    }
  }

  context.variables['_condition_result'] = conditionMet;

  return { conditionMet, skipNext: !conditionMet ? config.skipNext || 0 : 0 };
}

export async function executeDelay(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    milliseconds?: number;
    seconds?: number;
    duration?: number;
  };

  let ms =
    config.milliseconds != null
      ? Number(config.milliseconds)
      : config.duration != null
        ? Number(config.duration)
        : (config.seconds != null ? Number(config.seconds) : 1) * 1000;
  if (!Number.isFinite(ms) || ms < 0) ms = 0;

  const deadline = context.flowDeadlineAt;
  if (deadline != null) {
    const remain = deadline - Date.now();
    if (remain <= 0) {
      return { delayed: 0, skipped: 'deadline' as const };
    }
    ms = Math.min(ms, remain);
  }

  await new Promise((resolve) => setTimeout(resolve, ms));

  return { delayed: ms };
}
