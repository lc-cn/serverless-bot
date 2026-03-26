import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { id } = await params;
    const trigger = await storage.getTriggerForUser(id, session!.user.id);
    if (!trigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }
    return NextResponse.json({ trigger });
  } catch (error) {
    console.error('Failed to get trigger:', error);
    return NextResponse.json({ error: 'Failed to get trigger' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const existingTrigger = await storage.getTriggerForUser(id, session!.user.id);

    if (!existingTrigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    const {
      id: _bid,
      ownerId: _boid,
      createdAt: _bc,
      updatedAt: _bu,
      scope: scopeFromBody,
      ...bodyPatch
    } = body as Record<string, unknown> & { scope?: unknown };

    const trigger = {
      ...existingTrigger,
      ...bodyPatch,
      id,
      ownerId: existingTrigger.ownerId ?? session!.user.id,
      updatedAt: Date.now(),
    };

    if (Object.prototype.hasOwnProperty.call(body, 'scope')) {
      trigger.scope =
        scopeFromBody == null ? undefined : (scopeFromBody as (typeof existingTrigger)['scope']);
    }

    await storage.saveTrigger(trigger);
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'trigger.update',
      entityType: 'trigger',
      entityId: id,
      payload: { name: trigger.name, eventType: trigger.eventType, enabled: trigger.enabled },
      request: req,
    });
    return NextResponse.json({ success: true, trigger });
  } catch (error) {
    console.error('Failed to update trigger:', error);
    return NextResponse.json({ error: 'Failed to update trigger' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { id } = await params;
    // 删除 trigger（flow_triggers 关联会通过数据库外键级联删除）
    await storage.deleteTriggerForUser(id, session!.user.id);
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'trigger.delete',
      entityType: 'trigger',
      entityId: id,
      request: req,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete trigger:', error);
    return NextResponse.json({ error: 'Failed to delete trigger' }, { status: 500 });
  }
}
