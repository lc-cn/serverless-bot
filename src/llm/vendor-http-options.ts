import { z } from 'zod';

/**
 * 厂商 Profile `extra_json` 中的 `http` 字段：定制 chat/completions 请求。
 * 文档见控制台「厂商连接」高级 JSON 说明。
 */
export const LlmVendorHttpOptionsSchema = z.object({
  completionsPath: z.string().optional(),
  auth: z.enum(['bearer', 'api_key', 'authorization_raw']).optional(),
  apiKeyHeaderName: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  omitBodyKeys: z.array(z.string()).optional(),
  maxTokensField: z.enum(['max_tokens', 'max_completion_tokens']).optional(),
});

export type LlmVendorHttpOptions = z.infer<typeof LlmVendorHttpOptionsSchema>;

/** 从 Profile 整条 extra_json 解析出 http 选项 */
export function parseVendorProfileExtraJson(jsonStr: string | null | undefined): LlmVendorHttpOptions | undefined {
  if (jsonStr == null || String(jsonStr).trim() === '') return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(String(jsonStr)) as unknown;
  } catch {
    return undefined;
  }
  if (!raw || typeof raw !== 'object') return undefined;
  const http = (raw as { http?: unknown }).http;
  if (http == null || typeof http !== 'object') return undefined;
  const p = LlmVendorHttpOptionsSchema.safeParse(http);
  return p.success ? p.data : undefined;
}
