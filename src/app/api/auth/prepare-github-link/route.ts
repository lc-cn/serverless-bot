import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { getAuthSettings } from '@/lib/auth';

const COOKIE = 'oauth_link_github_uid';
const MAX_AGE = 600;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const settings = await getAuthSettings();
  if (!settings.providers.github.enabled || !settings.providers.github.allowBind) {
    return NextResponse.json({ error: 'github_bind_disabled' }, { status: 403 });
  }

  const jar = await cookies();
  jar.set(COOKIE, session.user.id, {
    httpOnly: true,
    maxAge: MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return NextResponse.json({ ok: true });
}
