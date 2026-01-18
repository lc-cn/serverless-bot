import { NextRequest, NextResponse } from 'next/server';
import { getTrigger, saveTrigger, deleteTrigger } from '@/lib/data';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trigger = await getTrigger(id);
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
    const { id } = await params;
    const body = await req.json();
    const existingTrigger = await getTrigger(id);
    
    if (!existingTrigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    const trigger = {
      ...existingTrigger,
      ...body,
      id: id,
      updatedAt: Date.now(),
    };

    await saveTrigger(trigger);
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
    const { id } = await params;
    await deleteTrigger(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete trigger:', error);
    return NextResponse.json({ error: 'Failed to delete trigger' }, { status: 500 });
  }
}
