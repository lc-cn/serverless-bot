import type { LlmVendorHttpOptions } from './vendor-http-options';

export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: unknown }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface LlmChatRequest {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  tools?: unknown[];
  timeoutMs: number;
  /** 厂商 Profile `extra_json.http`；鉴权、路径、头、body 合并与字段裁剪 */
  vendorHttp?: LlmVendorHttpOptions;
}

export interface LlmChatResult {
  /** 助手文本；若仅有 tool_calls 可能为空字符串 */
  content: string;
  raw: unknown;
}

export interface LlmVendorAdapter {
  readonly vendorKind: string;
  chat(req: LlmChatRequest): Promise<LlmChatResult>;
}
