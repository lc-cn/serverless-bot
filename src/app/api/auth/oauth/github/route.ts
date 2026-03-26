import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/persistence';

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const accounts = await storage.listOAuthAccountsForUser(session.user.id);
  const gh = accounts.find((a) => a.provider === 'github');
  if (!gh) {
    return NextResponse.json({ error: 'not_linked' }, { status: 404 });
  }

  await storage.unlinkOAuthAccount(gh.id, session.user.id);
  return NextResponse.json({ ok: true });
}
