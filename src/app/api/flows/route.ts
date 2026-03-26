import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { generateId } from '@/lib/shared/utils';
import { FlowSchema, type FlowTargetKind } from '@/types';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

/**
 * 获取所有 Flow
 */
export async function GET(request: NextRequest) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    const userId = session!.user.id;
    const flows = await storage.listFlowsForUser(userId, type || null);

    // 按优先级和事件类型排序
    flows.sort((a, b) => {
      if (a.eventType !== b.eventType) {
        return a.eventType.localeCompare(b.eventType);
      }
      return a.priority - b.priority;
    });

    return NextResponse.json({ flows });
  } catch (error) {
    console.error('Failed to get flows:', error);
    return NextResponse.json(
      { error: 'Failed to get flows' },
      { status: 500 }
    );
  }
}

/**
 * 创建新 Flow
 */
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const body = await request.json();
    const now = Date.now();

    const targetKind: FlowTargetKind = body.targetKind === 'agent' ? 'agent' : 'job';
    const llmAgentId =
      targetKind === 'agent' &&
      typeof body.llmAgentId === 'string' &&
      body.llmAgentId.trim()
        ? body.llmAgentId.trim()
        : null;
    const jobIds =
      targetKind === 'agent'
        ? []
        : Array.isArray(body.jobIds)
          ? body.jobIds
          : [];

    const flowData = {
      id: body.id || generateId(),
      name: body.name || 'Unnamed Flow',
      description: body.description,
      enabled: body.enabled ?? true,
      eventType: body.eventType || 'message',
      priority: body.priority ?? 100,
      triggerIds: body.triggerIds || [],
      targetKind,
      llmAgentId,
      jobIds,
      haltLowerPriorityAfterMatch: body.haltLowerPriorityAfterMatch === true,
      createdAt: now,
      updatedAt: now,
    };

    // 验证数据
    const parseResult = FlowSchema.safeParse(flowData);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid flow data', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const flow = { ...parseResult.data, ownerId: session!.user.id };
    await storage.saveFlow(flow);

    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'flow.create',
      entityType: 'flow',
      entityId: flow.id,
      payload: { name: flow.name, eventType: flow.eventType, enabled: flow.enabled },
      request,
    });

    return NextResponse.json({ success: true, flow });
  } catch (error) {
    console.error('Failed to create flow:', error);
    return NextResponse.json(
      { error: 'Failed to create flow' },
      { status: 500 }
    );
  }
}
