import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { getAuthSettings } from '@/lib/auth/auth-settings';
import { getExpectedOrigin, resolveRpId } from '@/lib/webauthn/rp';
import * as repo from '@/lib/webauthn/repo';
import { storage } from '@/lib/persistence';

export type AssertionInput = {
  id: string;
  response: { clientDataJSON: string };
};

function decodeChallengeFromResponse(response: AssertionInput): string | null {
  try {
    const buf = isoBase64URL.toBuffer(response.response.clientDataJSON);
    const json = JSON.parse(new TextDecoder().decode(buf)) as { challenge?: string };
    return typeof json.challenge === 'string' ? json.challenge : null;
  } catch {
    return null;
  }
}

export async function verifyPasskeyAssertionPayload(
  assertionJson: AssertionInput & Record<string, unknown>,
): Promise<Awaited<ReturnType<typeof storage.getUser>> | null> {
  const settings = await getAuthSettings();
  if (!settings.providers.passkey.enabled) return null;

  const expectedChallenge = decodeChallengeFromResponse(assertionJson);
  if (!expectedChallenge) return null;

  const taken = await repo.takeChallenge(expectedChallenge);
  if (!taken) return null;

  const cred = await repo.getCredentialByCredentialId(assertionJson.id);
  if (!cred) return null;

  if (taken.userId != null && taken.userId !== cred.userId) return null;

  const rpId = await resolveRpId();
  const origin = getExpectedOrigin();

  const verification = await verifyAuthenticationResponse({
    response: assertionJson as unknown as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: false,
    credential: {
      id: cred.credentialId,
      publicKey: isoBase64URL.toBuffer(cred.publicKey),
      counter: cred.counter,
      transports: cred.transports as ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[] | undefined,
    },
  });

  if (!verification.verified || !verification.authenticationInfo) return null;

  await repo.updateCredentialCounter(cred.id, verification.authenticationInfo.newCounter);

  const user = await storage.getUser(cred.userId);
  if (!user?.isActive) return null;
  return user;
}
