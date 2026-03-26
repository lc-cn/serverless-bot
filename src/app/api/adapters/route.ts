import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { adapterRegistry } from '@/core';
import { apiRequireAuth } from '@/lib/auth/permissions';

// 确保适配器被注册
import '@/adapters';

/**
 * 获取所有适配器配置
 */
export async function GET() {
  try {
    const { error } = await apiRequireAuth();
    if (error) return error;

    // 获取注册的适配器信息
    const registeredAdapters = adapterRegistry.getAll().map((adapter) => ({
      ...adapter.getInfo(),
      configSchema: adapter.getAdapterConfigUISchema(),
      botConfigSchema: adapter.getBotConfigUISchema(),
    }));

    // 获取已配置的适配器
    const configuredAdapters = await storage.getAdapters();

    // 合并信息
    const adapters = registeredAdapters.map((adapter) => {
      const config = configuredAdapters.find(
        (c) => c.platform === adapter.platform
      );
      return {
        ...adapter,
        configured: !!config,
        enabled: config?.enabled ?? false,
        config: config?.config ?? {},
      };
    });

    return NextResponse.json({ adapters });
  } catch (error) {
    console.error('Failed to get adapters:', error);
    return NextResponse.json(
      { error: 'Failed to get adapters' },
      { status: 500 }
    );
  }
}

/**
 * 保存适配器配置
 */
export async function POST(request: NextRequest) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const body = await request.json();
    const { platform, name, description, enabled, config } = body;

    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const existing = await storage.getAdapter(platform);

    const adapterConfig = {
      platform,
      name: name || platform,
      description,
      enabled: enabled ?? true,
      config: config || {},
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await storage.saveAdapter(adapterConfig);

    const { writeAuditLog } = await import('@/lib/audit');
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: existing ? 'adapter.update' : 'adapter.create',
      entityType: 'adapter',
      entityId: platform,
      payload: { platform, enabled: adapterConfig.enabled, name: adapterConfig.name },
      request,
    });

    return NextResponse.json({ success: true, adapter: adapterConfig });
  } catch (error) {
    console.error('Failed to save adapter:', error);
    return NextResponse.json(
      { error: 'Failed to save adapter' },
      { status: 500 }
    );
  }
}
