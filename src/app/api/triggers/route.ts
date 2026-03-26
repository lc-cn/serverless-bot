import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const triggers = await storage.listTriggersForUser(session!.user.id, type || null);
    return NextResponse.json({ triggers });
  } catch (error) {
    console.error('Failed to get triggers:', error);
    return NextResponse.json({ error: 'Failed to get triggers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const body = await req.json();
    const trigger = {
      id: `trigger_${Date.now()}`,
      name: body.name || 'Untitled Trigger',
      description: body.description || '',
      enabled: body.enabled !== false,
      eventType: body.eventType || 'message',
      match: body.match || { type: 'always', pattern: '' },
      permission: body.permission || {
        allowRoles: ['normal', 'admin', 'owner'],
        allowEnvironments: ['private', 'group'],
      },
      ...(body.scope ? { scope: body.scope } : {}),
      ownerId: session!.user.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storage.saveTrigger(trigger);
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'trigger.create',
      entityType: 'trigger',
      entityId: trigger.id,
      payload: { name: trigger.name, eventType: trigger.eventType, enabled: trigger.enabled },
      request: req,
    });
    return NextResponse.json({ success: true, trigger });
  } catch (error) {
    console.error('Failed to create trigger:', error);
    return NextResponse.json({ error: 'Failed to create trigger' }, { status: 500 });
  }
}
