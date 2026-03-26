import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { apiRequireAuth } from '@/lib/auth/permissions';
import {
  runSandboxChatPipeline,
  serializeFlowResultsForWire,
} from '@/lib/sandbox/run-chat-pipeline';
import { jsonApiError } from '@/lib/http/api-wire-error';
import { pickMessage } from '@/lib/i18n/catalog';
import { getServerApiLocale } from '@/lib/i18n/server-locale';
import {
  encodeSandboxSseMessage,
  parseSandboxPOSTBody,
  SANDBOX_SSE_EVENTS,
} from '@/lib/sandbox/sandbox-chat-wire';

/** 构建期须为字面量（Next webpack 静态分析）；运行时仍以 WEBHOOK_MAX_DURATION_SEC 等在业务内控制逻辑超时 */
export const maxDuration = 300;

/**
 * 沙盒对话：
 * - 请求：`{ schemaVersion: 1, message: { type: "text", content } }`（可选 meta）
 * - 成功：SSE，`event: sandbox.start|result|error`，`data` 含 `v: 1`
 * - 失败：JSON `{ v: 1, error: { code, message } }`（与 apiRequireAuth 一致）
 */
export async function POST(req: NextRequest) {
  const { error, session } = await apiRequireAuth();
  if (error) return error;

  const locale = await getServerApiLocale();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonApiError(400, 'INVALID_JSON', pickMessage(locale, 'Api.sandbox.INVALID_JSON'));
  }

  const parsed = parseSandboxPOSTBody(json);
  if (!parsed.ok) {
    return jsonApiError(
      400,
      parsed.code,
      pickMessage(locale, `Api.sandbox.${parsed.code}` as 'Api.sandbox.INVALID_BODY'),
    );
  }

  const userId = session!.user.id;
  const traceId = randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encodeSandboxSseMessage(SANDBOX_SSE_EVENTS.START, { traceId })
      );
      try {
        const { event, flowResults, outbound } = await runSandboxChatPipeline({
          userId,
          text: parsed.content,
          traceId,
        });
        controller.enqueue(
          encodeSandboxSseMessage(SANDBOX_SSE_EVENTS.RESULT, {
            traceId,
            outbound,
            flowResults: serializeFlowResultsForWire(flowResults),
            inboundEvent: {
              id: event.id,
              type: event.type,
              subType: event.subType,
              rawContent: event.rawContent,
            },
          })
        );
      } catch (e) {
        console.error('[POST /api/chat/sandbox SSE]', e);
        controller.enqueue(
          encodeSandboxSseMessage(SANDBOX_SSE_EVENTS.ERROR, {
            traceId,
            code: 'FLOW_EXECUTION_FAILED',
            message: e instanceof Error ? e.message : 'Flow execution failed',
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Sandbox-Chat-Protocol': String(1),
    },
  });
}
