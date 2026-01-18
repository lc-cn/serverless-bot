import { NextRequest, NextResponse } from 'next/server';
import { getBot } from '@/lib/data';

async function getApplicationId(token: string): Promise<string> {
  const res = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
    headers: {
      Authorization: `Bot ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch application id: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.id as string;
}

function buildCommandBody(body: any) {
  const { name, description, options } = body;
  if (!name || !description) {
    throw new Error('name and description are required');
  }
  return {
    name,
    description,
    type: 1,
    options: options || [],
  };
}

export async function POST(req: NextRequest) {
  try
  {
    const payload = await req.json();
    const { botId, scope = 'guild', guildId, command } = payload;

    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    const bot = await getBot(botId);
    if (!bot || bot.platform !== 'discord') {
      return NextResponse.json({ error: 'Discord bot not found' }, { status: 404 });
    }

    const token = (bot.config as any)?.token as string | undefined;
    if (!token) {
      return NextResponse.json({ error: 'Bot token missing in config' }, { status: 400 });
    }

    const applicationId = await getApplicationId(token);
    const body = buildCommandBody(command || payload.command || payload);

    let url = `https://discord.com/api/v10/applications/${applicationId}/commands`;
    if (scope === 'guild') {
      if (!guildId) {
        return NextResponse.json({ error: 'guildId is required for guild scope' }, { status: 400 });
      }
      url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: json, status: res.status }, { status: 502 });
    }

    return NextResponse.json({ command: json });
  }
  catch (error: any) {
    console.error('Create command error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const botId = searchParams.get('botId');
    const scope = searchParams.get('scope') || 'guild';
    const guildId = searchParams.get('guildId');

    if (!botId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400 });
    }

    const bot = await getBot(botId);
    if (!bot || bot.platform !== 'discord') {
      return NextResponse.json({ error: 'Discord bot not found' }, { status: 404 });
    }

    const token = (bot.config as any)?.token as string | undefined;
    if (!token) {
      return NextResponse.json({ error: 'Bot token missing in config' }, { status: 400 });
    }

    const applicationId = await getApplicationId(token);
    let url = `https://discord.com/api/v10/applications/${applicationId}/commands`;
    if (scope === 'guild') {
      if (!guildId) {
        return NextResponse.json({ error: 'guildId is required for guild scope' }, { status: 400 });
      }
      url = `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`;
    }

    const res = await fetch(url, {
      headers: {
        Authorization: `Bot ${token}`,
      },
    });

    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: json, status: res.status }, { status: 502 });
    }

    return NextResponse.json({ commands: json });
  } catch (error: any) {
    console.error('List commands error:', error);
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}
