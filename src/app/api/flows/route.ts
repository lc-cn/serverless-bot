import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/unified-storage';
import { generateId } from '@/lib/utils';
import { FlowSchema } from '@/types';

/**
 * 获取所有 Flow
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    let flows;
    if (type) {
      flows = await storage.getFlowsByType(type);
    } else {
      flows = await storage.getFlows();
    }

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
    const body = await request.json();
    const now = Date.now();

    const flowData = {
      id: body.id || generateId(),
      name: body.name || 'Unnamed Flow',
      description: body.description,
      enabled: body.enabled ?? true,
      eventType: body.eventType || 'message',
      priority: body.priority ?? 100,
      triggerIds: body.triggerIds || [],
      jobIds: body.jobIds || [],
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

    await storage.saveFlow(flowData);

    return NextResponse.json({ success: true, flow: flowData });
  } catch (error) {
    console.error('Failed to create flow:', error);
    return NextResponse.json(
      { error: 'Failed to create flow' },
      { status: 500 }
    );
  }
}
