import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { auth } from '@/lib/auth';
import { getAuthSettings } from '@/lib/auth';
import { getExpectedOrigin, resolveRpId } from '@/lib/webauthn/rp';
import * as repo from '@/lib/webauthn/repo';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const settings = await getAuthSettings();
  if (!settings.providers.passkey.enabled || !settings.providers.passkey.allowBind) {
    return NextResponse.json({ error: 'passkey_disabled' }, { status: 403 });
  }

  let credential: {
    id: string;
    rawId: string;
    type: string;
    response: { clientDataJSON: string; attestationObject: string; transports?: string[] };
  };
  try {
    credential = (await req.json()) as typeof credential;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!credential?.response?.clientDataJSON) {
    return NextResponse.json({ error: 'invalid_response' }, { status: 400 });
  }

  let challenge: string;
  try {
    const buf = isoBase64URL.toBuffer(credential.response.clientDataJSON);
    const json = JSON.parse(new TextDecoder().decode(buf)) as { challenge?: string };
    if (!json.challenge) throw new Error('no challenge');
    challenge = json.challenge;
  } catch {
    return NextResponse.json({ error: 'bad_client_data' }, { status: 400 });
  }

  const taken = await repo.takeChallenge(challenge);
  if (!taken?.userId || taken.userId !== session.user.id) {
    return NextResponse.json({ error: 'invalid_challenge' }, { status: 400 });
  }

  const rpId = await resolveRpId();
  const origin = getExpectedOrigin();

  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response: credential as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: false,
    });
  } catch (e) {
    console.error('[webauthn/register/verify]', e);
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'verification_failed' }, { status: 400 });
  }

  const { credential: regCred } = verification.registrationInfo;

  await repo.insertCredential({
    userId: session.user.id,
    credentialId: regCred.id,
    publicKey: regCred.publicKey,
    counter: regCred.counter,
    transports: regCred.transports as string[] | undefined,
  });

  return NextResponse.json({ ok: true });
}
