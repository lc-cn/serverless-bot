import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/unified-storage';
import { FlowSchema } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取 Flow 详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const flow = await storage.getFlow(id);

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
    const { id } = await params;
    const body = await request.json();

    const existing = await storage.getFlow(id);
    if (!existing) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const flowData = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      enabled: body.enabled ?? existing.enabled,
      eventType: body.eventType ?? existing.eventType,
      priority: body.priority ?? existing.priority,
      triggerIds: body.triggerIds ?? existing.triggerIds ?? [],
      jobIds: body.jobIds ?? existing.jobIds ?? [],
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

    await storage.saveFlow(flowData);

    return NextResponse.json({ success: true, flow: flowData });
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
    const { id } = await params;

    await storage.deleteFlow(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete flow:', error);
    return NextResponse.json(
      { error: 'Failed to delete flow' },
      { status: 500 }
    );
  }
}
