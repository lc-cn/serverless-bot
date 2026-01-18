import { NextRequest, NextResponse } from 'next/server';
import { getBotsByPlatform, saveBot, getBot } from '@/lib/data';
import { generateId } from '@/lib/utils';

interface RouteParams {
  params: Promise<{ platform: string }>;
}

/**
 * 获取平台下的所有机器人
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { platform } = await params;
    const bots = await getBotsByPlatform(platform);
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
    const { platform } = await params;
    const body = await request.json();

    const now = Date.now();
    const botConfig = {
      id: body.id || generateId(),
      platform,
      name: body.name || 'Unnamed Bot',
      enabled: body.enabled ?? true,
      config: body.config || {},
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
