import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { FlowSchema } from '@/types';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取 Flow 详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { id } = await params;
    const flow = await storage.getFlowForUser(id, session!.user.id);

    if (!flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    return NextResponse.json({ flow });
  } catch (error) {
    console.error('Failed to get flow:', error);
    return NextResponse.json(
      { error: 'Failed to get flow' },
      { status: 500 }
    );
  }
}

/**
 * 更新 Flow
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const existing = await storage.getFlowForUser(id, session!.user.id);
    if (!existing) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const targetKind =
      body.targetKind === 'agent' || body.targetKind === 'job'
        ? body.targetKind
        : (existing.targetKind ?? 'job');

    let llmAgentId: string | null =
      body.llmAgentId !== undefined
        ? typeof body.llmAgentId === 'string' && body.llmAgentId.trim()
          ? body.llmAgentId.trim()
          : null
        : (existing.llmAgentId ?? null);

    let jobIds =
      body.jobIds !== undefined ? body.jobIds : (existing.jobIds ?? []);

    if (targetKind === 'agent') {
      jobIds = [];
    } else {
      llmAgentId = null;
    }

    const flowData = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      enabled: body.enabled ?? existing.enabled,
      eventType: body.eventType ?? existing.eventType,
      priority: body.priority ?? existing.priority,
      triggerIds: body.triggerIds ?? existing.triggerIds ?? [],
      targetKind,
      llmAgentId,
      jobIds,
      haltLowerPriorityAfterMatch:
        body.haltLowerPriorityAfterMatch !== undefined
          ? body.haltLowerPriorityAfterMatch === true
          : existing.haltLowerPriorityAfterMatch,
      ownerId: existing.ownerId ?? session!.user.id,
      updatedAt: Date.now(),
    };

    // 验证数据
    const parseResult = FlowSchema.safeParse(flowData);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid flow data', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const flow = parseResult.data;
    await storage.saveFlow(flow);

    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'flow.update',
      entityType: 'flow',
      entityId: id,
      payload: { name: flow.name, eventType: flow.eventType, enabled: flow.enabled },
      request,
    });

    return NextResponse.json({ success: true, flow });
  } catch (error) {
    console.error('Failed to update flow:', error);
    return NextResponse.json(
      { error: 'Failed to update flow' },
      { status: 500 }
    );
  }
}

/**
 * 删除 Flow
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { id } = await params;

    await storage.deleteFlowForUser(id, session!.user.id);

    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'flow.delete',
      entityType: 'flow',
      entityId: id,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete flow:', error);
    return NextResponse.json(
      { error: 'Failed to delete flow' },
      { status: 500 }
    );
  }
}
