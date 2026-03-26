import { NextRequest, NextResponse } from 'next/server';
import { getBotsByPlatform, saveBot, getBot } from '@/lib/persistence';
import { generateId } from '@/lib/shared/utils';
import { apiRequireAuth } from '@/lib/auth/permissions';

interface RouteParams {
  params: Promise<{ platform: string }>;
}

/**
 * 获取平台下当前用户的机器人
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { platform } = await params;
    // 只返回当前用户创建的机器人
    const bots = await getBotsByPlatform(platform, session!.user.id);
    return NextResponse.json({ bots });
  } catch (error) {
    console.error('Failed to get bots:', error);
    return NextResponse.json(
      { error: 'Failed to get bots' },
      { status: 500 }
    );
  }
}

/**
 * 创建新机器人
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { error, session } = await apiRequireAuth();
    if (error) return error;

    const { platform } = await params;
    const body = await request.json();

    const now = Date.now();
    const botConfig = {
      id: body.id || generateId(),
      platform,
      name: body.name || 'Unnamed Bot',
      enabled: body.enabled ?? true,
      config: body.config || {},
      ownerId: session!.user.id, // 记录创建者
      createdAt: now,
      updatedAt: now,
    };

    await saveBot(botConfig);

    return NextResponse.json({ success: true, bot: botConfig });
  } catch (error) {
    console.error('Failed to create bot:', error);
    return NextResponse.json(
      { error: 'Failed to create bot' },
      { status: 500 }
    );
  }
}
