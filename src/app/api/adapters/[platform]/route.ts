import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/unified-storage';
import { adapterRegistry } from '@/core';

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
    const { platform } = await params;

    const adapter = adapterRegistry.get(platform);
    if (!adapter) {
      return NextResponse.json(
        { error: 'Adapter not found' },
        { status: 404 }
      );
    }

    const config = await storage.getAdapter(platform);
    const bots = await storage.getBotsByPlatform(platform);

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
    const { platform } = await params;

    await storage.deleteAdapter(platform);

    // 同时删除该平台下的所有 Bot
    const bots = await storage.getBotsByPlatform(platform);
    for (const bot of bots) {
      await storage.deleteBot(bot.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete adapter:', error);
    return NextResponse.json(
      { error: 'Failed to delete adapter' },
      { status: 500 }
    );
  }
}
