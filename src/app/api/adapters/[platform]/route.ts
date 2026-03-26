import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { adapterRegistry } from '@/core';
import { apiRequireAuth, apiRequirePermission } from '@/lib/auth/permissions';

// 确保适配器被注册
import '@/adapters';

interface RouteParams {
  params: Promise<{ platform: string }>;
}

/**
 * 获取单个适配器详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { platform } = await params;

    const adapter = adapterRegistry.get(platform);
    if (!adapter) {
      return NextResponse.json(
        { error: 'Adapter not found' },
        { status: 404 }
      );
    }

    const config = await storage.getAdapter(platform);
    // 只返回当前用户创建的机器人
    const bots = await storage.getBotsByPlatform(platform, session!.user.id);

    return NextResponse.json({
      ...adapter.getInfo(),
      configSchema: adapter.getAdapterConfigUISchema(),
      botConfigSchema: adapter.getBotConfigUISchema(),
      configured: !!config,
      enabled: config?.enabled ?? false,
      config: config?.config ?? {},
      bots,
    });
  } catch (error) {
    console.error('Failed to get adapter:', error);
    return NextResponse.json(
      { error: 'Failed to get adapter' },
      { status: 500 }
    );
  }
}

/**
 * 更新适配器配置
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequirePermission('adapters:update');
    if (error) return error;

    const { platform } = await params;
    const body = await request.json();

    const existing = await storage.getAdapter(platform);
    const now = Date.now();

    const adapterConfig = {
      platform,
      name: body.name || existing?.name || platform,
      description: body.description || existing?.description,
      enabled: body.enabled ?? existing?.enabled ?? true,
      config: body.config || existing?.config || {},
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await storage.saveAdapter(adapterConfig);

    const { writeAuditLog } = await import('@/lib/audit');
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'adapter.update',
      entityType: 'adapter',
      entityId: platform,
      payload: { platform, enabled: adapterConfig.enabled, name: adapterConfig.name },
      request,
    });

    return NextResponse.json({ success: true, adapter: adapterConfig });
  } catch (error) {
    console.error('Failed to update adapter:', error);
    return NextResponse.json(
      { error: 'Failed to update adapter' },
      { status: 500 }
    );
  }
}

/**
 * 删除适配器配置
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { platform } = await params;

    await storage.deleteAdapter(platform);

    // 只删除当前用户在该平台下的 Bot
    const bots = await storage.getBotsByPlatform(platform, session!.user.id);
    for (const bot of bots) {
      await storage.deleteBot(bot.id);
    }

    const { writeAuditLog } = await import('@/lib/audit');
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'adapter.delete',
      entityType: 'adapter',
      entityId: platform,
      payload: { platform, botsRemoved: bots.map((b) => b.id) },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete adapter:', error);
    return NextResponse.json(
      { error: 'Failed to delete adapter' },
      { status: 500 }
    );
  }
}
