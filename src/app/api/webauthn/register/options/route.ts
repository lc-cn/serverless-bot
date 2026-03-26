import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { auth } from '@/lib/auth';
import { getAuthSettings } from '@/lib/auth';
import { resolveRpId, resolveRpName } from '@/lib/webauthn/rp';
import * as repo from '@/lib/webauthn/repo';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const settings = await getAuthSettings();
  if (!settings.providers.passkey.enabled || !settings.providers.passkey.allowBind) {
    return NextResponse.json({ error: 'passkey_disabled' }, { status: 403 });
  }

  await repo.purgeExpiredChallenges();

  const rpId = await resolveRpId();
  const rpName = await resolveRpName();
  const creds = await repo.listCredentialsForUser(session.user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userName: session.user.email || session.user.id,
    userDisplayName: session.user.name || session.user.email || 'User',
    userID: new TextEncoder().encode(session.user.id).slice(0, 64),
    attestationType: 'none',
    excludeCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: c.transports as ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  const exp = new Date(Date.now() + 5 * 60 * 1000);
  await repo.saveChallenge(options.challenge, session.user.id, exp);

  return NextResponse.json(options);
}
