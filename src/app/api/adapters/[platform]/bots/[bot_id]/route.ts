import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ platform: string; bot_id: string }>;
}

/**
 * 获取机器人详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { bot_id: botId } = await params;
    const bot = await storage.getBot(botId);

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // 检查是否是机器人的所有者
    if (bot.ownerId && bot.ownerId !== session!.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { platform, bot_id: botId } = await params;
    const body = await request.json();

    const existing = await storage.getBot(botId);
    if (!existing) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // 检查是否是机器人的所有者
    if (existing.ownerId && existing.ownerId !== session!.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const botConfig = {
      ...existing,
      name: body.name ?? existing.name,
      enabled: body.enabled ?? existing.enabled,
      config: body.config ?? existing.config,
      updatedAt: Date.now(),
    };

    await storage.saveBot(botConfig);

    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'bot.update',
      entityType: 'bot',
      entityId: botId,
      payload: { platform, name: botConfig.name, enabled: botConfig.enabled },
      request,
    });

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
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { bot_id: botId } = await params;

    const existing = await storage.getBot(botId);
    if (!existing) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // 检查是否是机器人的所有者
    if (existing.ownerId && existing.ownerId !== session!.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await storage.deleteBot(botId);

    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'bot.delete',
      entityType: 'bot',
      entityId: botId,
      payload: { platform: existing.platform, name: existing.name },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete bot:', error);
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    );
  }
}
