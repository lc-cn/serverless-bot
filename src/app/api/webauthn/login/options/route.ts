import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getAuthSettings } from '@/lib/auth';
import { resolveRpId } from '@/lib/webauthn/rp';
import * as repo from '@/lib/webauthn/repo';
import { storage } from '@/lib/persistence';

export async function POST(req: NextRequest) {
  const settings = await getAuthSettings();
  if (!settings.providers.passkey.enabled) {
    return NextResponse.json({ error: 'passkey_disabled' }, { status: 403 });
  }

  let identifier: string | undefined;
  try {
    const b = await req.json();
    identifier = typeof (b as { identifier?: string }).identifier === 'string'
      ? (b as { identifier: string }).identifier.trim()
      : undefined;
  } catch {
    identifier = undefined;
  }

  await repo.purgeExpiredChallenges();

  const rpId = await resolveRpId();
  let allowCredentials: { id: string; transports?: ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[] }[] =
    [];

  let userId: string | null = null;
  if (identifier) {
    const norm = identifier.toLowerCase();
    const user =
      (await storage.getUserByIdentifier(norm)) ||
      (await storage.getUserByEmail(norm)) ||
      (await storage.getUserByUsername(norm));
    if (user) {
      userId = user.id;
      const creds = await repo.listCredentialsForUser(user.id);
      allowCredentials = creds.map((c) => ({
        id: c.credentialId,
        transports: c.transports as ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[] | undefined,
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    allowCredentials: allowCredentials.length ? allowCredentials : undefined,
    userVerification: 'preferred',
  });

  const exp = new Date(Date.now() + 5 * 60 * 1000);
  await repo.saveChallenge(options.challenge, userId, exp);

  return NextResponse.json(options);
}
