import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listCredentialsForUser } from '@/lib/webauthn/repo';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const list = await listCredentialsForUser(session.user.id);
  return NextResponse.json({
    credentials: list.map((c) => ({
      id: c.id,
      deviceName: c.deviceName ?? null,
      createdAt: c.createdAt ?? null,
    })),
  });
}
