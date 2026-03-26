import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteCredentialForUser } from '@/lib/webauthn/repo';

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const ok = await deleteCredentialForUser(id, session.user.id);
  if (!ok) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
