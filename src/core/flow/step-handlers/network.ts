import type { FlowAction } from '@/types';
import type { JobContext } from '../types';
import { interpolate } from '../step-template';

function resolveCallApiTimeoutMs(context: JobContext, configMs?: number): number {
  const defaultMs = context.platform?.callApiDefaultTimeoutMs ?? 60_000;
  let ms =
    configMs != null && Number.isFinite(Number(configMs)) && Number(configMs) > 0
      ? Number(configMs)
      : Number.isFinite(defaultMs) && defaultMs > 0
        ? defaultMs
        : 60_000;
  if (ms < 1) ms = 1;
  const cap = context.platform?.callApiMaxTimeoutMs;
  if (cap != null && Number.isFinite(cap) && cap > 0) {
    ms = Math.min(ms, cap);
  }
  if (context.flowDeadlineAt != null) {
    const remain = context.flowDeadlineAt - Date.now();
    if (remain <= 0) {
      throw new Error('call_api: flow execution budget exceeded before request');
    }
    ms = Math.min(ms, remain);
  }
  return ms;
}

export async function executeCallApi(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    saveAs?: string;
    responseKind?: 'json' | 'text' | 'auto';
    /** 单请求超时（毫秒），默认 CALL_API_DEFAULT_TIMEOUT_MS，且不超过流程预算与 CALL_API_MAX_TIMEOUT_MS */
    timeoutMs?: number;
  };

  const url = interpolate(config.url, context);
  const method = (config.method || 'GET').toUpperCase();
  const headerRecord: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.headers || {})) {
    headerRecord[k] = interpolate(v, context);
  }

  let body: string | undefined;
  if (config.body !== undefined && method !== 'GET' && method !== 'HEAD') {
    const raw = interpolate(
      typeof config.body === 'string' ? config.body : JSON.stringify(config.body),
      context
    );
    try {
      JSON.parse(raw);
      body = raw;
      if (!headerRecord['Content-Type'] && !headerRecord['content-type']) {
        headerRecord['Content-Type'] = 'application/json';
      }
    } catch {
      body = raw;
      if (!headerRecord['Content-Type'] && !headerRecord['content-type']) {
        headerRecord['Content-Type'] = 'text/plain; charset=utf-8';
      }
    }
  }

  const timeoutMs = resolveCallApiTimeoutMs(context, config.timeoutMs);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: headerRecord,
      body,
      signal: abort.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`call_api: timeout after ${timeoutMs}ms`);
    }
    throw e;
  }
  clearTimeout(timer);

  const ct = response.headers.get('content-type') || '';
  const kind = config.responseKind || 'auto';
  let data: unknown;
  if (kind === 'text') {
    data = await response.text();
  } else if (kind === 'json') {
    data = await response.json();
  } else if (ct.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const snippet = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`HTTP ${response.status}: ${snippet.slice(0, 500)}`);
  }

  if (config.saveAs) {
    context.variables[config.saveAs] = data;
  }

  return { ok: response.ok, status: response.status, data };
}

export async function executeCallBot(
  action: FlowAction,
  context: JobContext
): Promise<unknown> {
  const config = action.config as {
    method: string;
    args?: unknown[];
    saveAs?: string;
  };

  const bot = context.bot as unknown as Record<string, unknown>;
  const methodFn = bot[config.method];

  if (typeof methodFn !== 'function') {
    throw new Error(`Bot method '${config.method}' not found`);
  }

  const args = config.args || [];
  const result = await methodFn.apply(context.bot, args);

  if (config.saveAs) {
    context.variables[config.saveAs] = result;
  }

  return result;
}
