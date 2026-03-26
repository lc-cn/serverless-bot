import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { storage } from '@/lib/persistence';
import { getAuthSettings } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { SYSTEM_ROLES } from '@/types/auth';
import { isRelationalDatabaseConfigured } from '@/lib/data-layer';

const bodySchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'username_alphanumeric'),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  if (!isRelationalDatabaseConfigured()) {
    return NextResponse.json({ error: 'database_not_configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
  }

  const { username, email, password, name } = parsed.data;
  const usernameNorm = username.trim().toLowerCase();
  const emailNorm = email.trim().toLowerCase();

  await storage.initializeRBAC();
  const settings = await getAuthSettings();
  if (!settings.registrationEnabled) {
    return NextResponse.json({ error: 'registration_disabled' }, { status: 403 });
  }

  if (await storage.getUserByUsername(usernameNorm)) {
    return NextResponse.json({ error: 'username_taken' }, { status: 409 });
  }
  if (await storage.getUserByEmail(emailNorm)) {
    return NextResponse.json({ error: 'email_taken' }, { status: 409 });
  }

  const count = await storage.countUsers();
  const roleIds = count === 0 ? [SYSTEM_ROLES.SUPER_ADMIN.id] : [SYSTEM_ROLES.VIEWER.id];
  const passwordHash = await hashPassword(password);

  try {
    const user = await storage.createUser({
      username: usernameNorm,
      email: emailNorm,
      name: name?.trim() || usernameNorm,
      passwordHash,
      roleIds,
      isActive: true,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        roleIds: user.roleIds,
      },
    });
  } catch (e) {
    console.error('[auth/register]', e);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
