import type { LlmVendorAdapter, LlmChatRequest, LlmChatResult } from '../types';
import type { LlmVendorHttpOptions } from '../vendor-http-options';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildCompletionsUrl(baseUrl: string, http?: LlmVendorHttpOptions): string {
  const pathRaw = http?.completionsPath?.trim();
  if (pathRaw && /^https?:\/\//i.test(pathRaw)) {
    return pathRaw.replace(/\/+$/, '');
  }
  const base = normalizeBaseUrl(baseUrl);
  const path = (pathRaw && pathRaw.replace(/^\/+/, '')) || 'chat/completions';
  return `${base}/${path}`;
}

function interpolateApiKey(value: string, apiKey: string): string {
  if (!value.includes('{{apiKey}}')) return value;
  return value.split('{{apiKey}}').join(apiKey);
}

function buildAuthHeaders(apiKey: string, http?: LlmVendorHttpOptions): Record<string, string> {
  const auth = http?.auth ?? 'bearer';
  const out: Record<string, string> = {};
  if (auth === 'bearer') {
    out.Authorization = `Bearer ${apiKey}`;
  } else if (auth === 'api_key') {
    const name = http?.apiKeyHeaderName?.trim() || 'x-api-key';
    out[name] = apiKey;
  } else if (auth === 'authorization_raw') {
    out.Authorization = apiKey;
  }
  return out;
}

export class OpenAiCompatibleAdapter implements LlmVendorAdapter {
  constructor(readonly vendorKind: string) {}

  async chat(req: LlmChatRequest): Promise<LlmChatResult> {
    const url = buildCompletionsUrl(req.baseUrl, req.vendorHttp);
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages.map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content };
        }
        if (m.role === 'assistant' && 'tool_calls' in m && m.tool_calls != null) {
          return { role: m.role, content: m.content, tool_calls: m.tool_calls };
        }
        return { role: m.role, content: m.content };
      }),
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) {
      const field = req.vendorHttp?.maxTokensField ?? 'max_tokens';
      if (field === 'max_completion_tokens') {
        body.max_completion_tokens = req.maxTokens;
      } else {
        body.max_tokens = req.maxTokens;
      }
    }
    if (req.jsonMode) body.response_format = { type: 'json_object' };
    if (req.tools && req.tools.length > 0) body.tools = req.tools;

    if (req.vendorHttp?.body && typeof req.vendorHttp.body === 'object') {
      Object.assign(body, req.vendorHttp.body);
    }
    if (req.vendorHttp?.omitBodyKeys && req.vendorHttp.omitBodyKeys.length > 0) {
      for (const k of req.vendorHttp.omitBodyKeys) {
        delete body[k];
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(req.apiKey, req.vendorHttp),
    };
    if (req.vendorHttp?.headers) {
      for (const [k, v] of Object.entries(req.vendorHttp.headers)) {
        if (!k.trim()) continue;
        headers[k] = interpolateApiKey(v, req.apiKey);
      }
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), req.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`LLM response not JSON: ${text.slice(0, 200)}`);
      }

      if (!response.ok) {
        const errMsg =
          typeof data === 'object' && data && 'error' in data
            ? String((data as { error?: { message?: string } }).error?.message || response.statusText)
            : response.statusText;
        throw new Error(`LLM HTTP ${response.status}: ${errMsg}`);
      }

      const choices = (data as { choices?: Array<{ message?: { content?: string | null; tool_calls?: unknown } }> })
        .choices;
      const msg = choices?.[0]?.message;
      const content =
        typeof msg?.content === 'string'
          ? msg.content
          : msg?.content === null || msg?.content === undefined
            ? ''
            : String(msg.content);

      return { content, raw: data };
    } finally {
      clearTimeout(t);
    }
  }
}
