import { NextRequest, NextResponse } from 'next/server';
import { getFlowQueueMetrics } from '@/lib/webhook/webhook-flow-queue';
import { assertFlowWorkerAuthorized } from '@/lib/webhook/webhook-env';
import { getKvBackendKind } from '@/lib/data-layer';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!assertFlowWorkerAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const m = await getFlowQueueMetrics();
    return NextResponse.json({
      ok: true,
      queueLen: m.queueLen,
      dlqLen: m.dlqLen,
      retryDueCount: m.retryDueCount,
      retryScheduledTotal: m.retryScheduledTotal,
      kvBackend: getKvBackendKind(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
