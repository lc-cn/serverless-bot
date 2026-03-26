import type { JobContext } from './types';

/**
 * 模板表达式（evaluateExpression / interpolate）使用受限 `Function` 沙箱，仍等价于用户可控流程内执行代码。
 * 生产环境应限制流程编辑权限，勿将编排能力开放给不可信租户。
 */

/**
 * 通过路径获取值
 * 支持从 context.variables 中获取变量
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  if (obj && typeof obj === 'object' && 'variables' in obj) {
    const context = obj as JobContext;
    const keys = path.split('.');

    if (keys[0] in context.variables) {
      let current = context.variables[keys[0]];
      for (let i = 1; i < keys.length; i++) {
        if (current === null || current === undefined) {
          return undefined;
        }
        current = (current as Record<string, unknown>)[keys[i]];
      }
      return current;
    }
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * 安全执行 JS 表达式
 */
export function evaluateExpression(expr: string, context: JobContext): unknown {
  const safeGlobals = {
    JSON,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
  };
  /** null / true / false / undefined 不可作为 Function 形参名；表达式内可直接写字面量 */

  const variables: Record<string, unknown> = { ...context.variables };

  if (context.event) {
    variables.event = context.event;
    variables.message = context.event;
  }
  if (context.flow) {
    variables.flow = context.flow;
  }
  if (context.job) {
    variables.job = context.job;
  }
  if (context.bot) {
    variables.bot = {
      id: context.bot.id,
      name: context.bot.name,
      platform: context.bot.platform,
    };
  }

  const paramNames = [...Object.keys(safeGlobals), ...Object.keys(variables)];
  const paramValues = [...Object.values(safeGlobals), ...Object.values(variables)];

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(...paramNames, `"use strict"; return (${expr});`);

  return fn(...paramValues);
}

/**
 * 字符串插值：${variable} / ${expression}
 */
export function interpolate(template: string, context: JobContext): string {
  if (!template.includes('${')) {
    return template;
  }

  const originalTemplate = template;
  const result = template.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    const trimmedExpr = expr.trim();

    const simpleValue = getValueByPath(context, trimmedExpr);
    if (simpleValue !== undefined) {
      const replacement =
        typeof simpleValue === 'object' ? JSON.stringify(simpleValue) : String(simpleValue);
      console.debug('[Interpolate] Variable replacement', {
        variable: trimmedExpr,
        found: true,
        value: replacement.substring(0, 100),
      });
      return replacement;
    }

    try {
      const ev = evaluateExpression(trimmedExpr, context);
      const replacement =
        ev !== undefined ? (typeof ev === 'object' ? JSON.stringify(ev) : String(ev)) : '';
      console.debug('[Interpolate] Expression evaluated', {
        expression: trimmedExpr.substring(0, 50),
        result: replacement.substring(0, 100),
      });
      return replacement;
    } catch (error) {
      console.warn('[Interpolate] Expression evaluation failed', {
        expression: trimmedExpr,
        error: String(error),
      });
      return match;
    }
  });

  if (originalTemplate !== result) {
    console.debug('[Interpolate] Template changed', {
      before: originalTemplate.substring(0, 100),
      after: result.substring(0, 100),
    });
  }

  return result;
}
