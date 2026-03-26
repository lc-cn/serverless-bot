import { NextRequest, NextResponse } from 'next/server';
import { getEventLogs } from '@/lib/kv/kv-logs';
import { apiRequireBotAccess } from '@/lib/auth/permissions';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const botId = searchParams.get('bot_id');
    const limit = Number(searchParams.get('limit') || '50');

    if (!platform || !botId) {
      return NextResponse.json({ error: 'platform and bot_id required' }, { status: 400 });
    }

    const gate = await apiRequireBotAccess(botId, 'read');
    if (gate.error) return gate.error;

    const logs = await getEventLogs(platform, botId, Math.max(1, Math.min(200, limit)));
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Failed to get event logs', error);
    return NextResponse.json({ error: 'Failed to get event logs' }, { status: 500 });
  }
}
