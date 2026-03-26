/**
 * 沙盒对话 HTTP / SSE 线级协议（发送与接收约定）
 */

import type { SandboxOutboundCapture } from '@/lib/sandbox/sandbox-bot';
import { API_WIRE_VERSION, type ApiWireErrorBody } from '@/lib/http/api-wire-error';

/** 与全局 API/SSE `v` 对齐 */
export const SANDBOX_CHAT_WIRE_VERSION = API_WIRE_VERSION;

/** 客户端 → POST /api/chat/sandbox */
export type SandboxChatRequestV1 = {
  schemaVersion: typeof SANDBOX_CHAT_WIRE_VERSION;
  message: {
    type: 'text';
    /** 用户可见正文；首尾空白会在服务端 trim */
    content: string;
  };
  meta?: {
    clientRequestId?: string;
  };
};

export type SandboxChatErrorBodyV1 = ApiWireErrorBody;

export const SANDBOX_SSE_EVENTS = {
  START: 'sandbox.start',
  RESULT: 'sandbox.result',
  ERROR: 'sandbox.error',
} as const;

export type SandboxSseEventName = (typeof SANDBOX_SSE_EVENTS)[keyof typeof SANDBOX_SSE_EVENTS];

export type SandboxSseFlowResultWire = {
  flowId: string;
  matched: boolean;
  executed: boolean;
  duration: number;
  error?: string;
  jobs?: unknown[];
};

export type ParsedSandboxChatRequest =
  | { ok: true; content: string; clientRequestId?: string }
  | { ok: false; code: string };

/**
 * 解析 POST body：仅接受 `SandboxChatRequestV1`。
 */
export function parseSandboxPOSTBody(body: unknown): ParsedSandboxChatRequest {
  if (body === null || typeof body !== 'object') {
    return { ok: false, code: 'INVALID_BODY' };
  }
  const o = body as Record<string, unknown>;

  if ('text' in o) {
    return {
      ok: false,
      code: 'UNSUPPORTED_BODY',
    };
  }

  if (o.schemaVersion !== SANDBOX_CHAT_WIRE_VERSION) {
    return {
      ok: false,
      code: 'UNSUPPORTED_SCHEMA',
    };
  }

  const msg = o.message;
  if (msg === null || typeof msg !== 'object') {
    return { ok: false, code: 'INVALID_MESSAGE' };
  }
  const m = msg as Record<string, unknown>;
  if (m.type !== 'text') {
    return { ok: false, code: 'UNSUPPORTED_MESSAGE_TYPE' };
  }
  if (typeof m.content !== 'string') {
    return { ok: false, code: 'INVALID_MESSAGE_CONTENT' };
  }
  const content = m.content.trim();
  if (!content) {
    return { ok: false, code: 'EMPTY_MESSAGE' };
  }

  let clientRequestId: string | undefined;
  const meta = o.meta;
  if (meta !== undefined) {
    if (typeof meta !== 'object' || meta === null) {
      return { ok: false, code: 'INVALID_META_NOT_OBJECT' };
    }
    const id = (meta as Record<string, unknown>).clientRequestId;
    if (id !== undefined && typeof id !== 'string') {
      return { ok: false, code: 'INVALID_META_CLIENT_REQUEST_ID' };
    }
    clientRequestId = id as string | undefined;
  }

  return { ok: true, content, clientRequestId };
}

export function encodeSandboxSseMessage(
  eventName: SandboxSseEventName,
  payload: Record<string, unknown>
): Uint8Array {
  const data = JSON.stringify({ ...payload, v: SANDBOX_CHAT_WIRE_VERSION });
  return new TextEncoder().encode(`event: ${eventName}\ndata: ${data}\n\n`);
}

export type SandboxSseBlockParsed = {
  event: string | null;
  payload: Record<string, unknown> | null;
};

export function parseSandboxSseBlock(block: string): SandboxSseBlockParsed {
  let event: string | null = null;
  const dataParts: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || null;
    } else if (line.startsWith('data:')) {
      dataParts.push(line.slice(5).trimStart());
    }
  }
  const raw = dataParts.join('\n');
  if (!raw) {
    return { event, payload: null };
  }
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (payload.v !== SANDBOX_CHAT_WIRE_VERSION) {
      return { event, payload: null };
    }
    return { event, payload };
  } catch {
    return { event, payload: null };
  }
}

/** `sandbox.result` 的 data 载荷（除 `v` 外） */
export type SandboxSseResultData = {
  traceId: string;
  outbound: SandboxOutboundCapture[];
  flowResults: SandboxSseFlowResultWire[];
  inboundEvent: {
    id: string;
    type: string;
    subType: string;
    rawContent: string;
  };
};
