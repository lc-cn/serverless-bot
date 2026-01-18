import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/unified-storage';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  try {
    const triggers = type 
      ? await storage.getTriggersByType(type)
      : await storage.getTriggers();
    return NextResponse.json({ triggers });
  } catch (error) {
    console.error('Failed to get triggers:', error);
    return NextResponse.json({ error: 'Failed to get triggers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storage.saveTrigger(trigger);
    return NextResponse.json({ success: true, trigger });
  } catch (error) {
    console.error('Failed to create trigger:', error);
    return NextResponse.json({ error: 'Failed to create trigger' }, { status: 500 });
  }
}
