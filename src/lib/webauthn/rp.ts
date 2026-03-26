import { getAuthSettings } from '@/lib/auth/auth-settings';

export function getWebAuthnRpId(): string {
  const base = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'http://localhost:3000';
  try {
    return new URL(base).hostname;
  } catch {
    return 'localhost';
  }
}

export async function resolveRpId(): Promise<string> {
  const s = await getAuthSettings();
  const fromSettings = s.providers.passkey.rpId?.trim();
  if (fromSettings) return fromSettings;
  return getWebAuthnRpId();
}

export async function resolveRpName(): Promise<string> {
  const s = await getAuthSettings();
  return s.providers.passkey.rpName?.trim() || 'Serverless Bot';
}

export function getExpectedOrigin(): string {
  const base = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'http://localhost:3000';
  try {
    return new URL(base).origin;
  } catch {
    return 'http://localhost:3000';
  }
}
