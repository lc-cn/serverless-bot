import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/unified-storage';

interface RouteParams {
  params: Promise<{ platform: string; bot_id: string }>;
}

/**
 * 获取机器人详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { bot_id: botId } = await params;
    const bot = await storage.getBot(botId);

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    return NextResponse.json({ bot });
  } catch (error) {
    console.error('Failed to get bot:', error);
    return NextResponse.json(
      { error: 'Failed to get bot' },
      { status: 500 }
    );
  }
}

/**
 * 更新机器人配置
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { platform, bot_id: botId } = await params;
    const body = await request.json();

    const existing = await storage.getBot(botId);
    if (!existing) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const botConfig = {
      ...existing,
      name: body.name ?? existing.name,
      enabled: body.enabled ?? existing.enabled,
      config: body.config ?? existing.config,
      updatedAt: Date.now(),
    };

    await storage.saveBot(botConfig);

    return NextResponse.json({ success: true, bot: botConfig });
  } catch (error) {
    console.error('Failed to update bot:', error);
    return NextResponse.json(
      { error: 'Failed to update bot' },
      { status: 500 }
    );
  }
}

/**
 * 删除机器人
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { bot_id: botId } = await params;

    await storage.deleteBot(botId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete bot:', error);
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    );
  }
}
