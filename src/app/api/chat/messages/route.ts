import { NextRequest, NextResponse } from 'next/server';
import { getChatStore, type PeerType } from '@/lib/chat-store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const botId = searchParams.get('bot_id');
    const peerId = searchParams.get('peer_id');
    const peerType = searchParams.get('peer_type');

    if (!platform || !botId) {
      return NextResponse.json({ error: 'platform and bot_id required' }, { status: 400 });
    }

    const store = getChatStore();
    const messages = await store.listMessages({ platform, botId, peerId, peerType: peerType as PeerType | null });
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Failed to get messages', error);
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}
