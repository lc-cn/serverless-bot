import type { NextResponse } from 'next/server';

export const INSTALL_OK_COOKIE = 'sb_install_ok';

/** 优先专用密钥，否则与会话共用（须足够长、随机） */
export function getInstallCookieSigningSecret(): string {
  return (
    process.env.INSTALL_COOKIE_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    ''
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 =
    typeof btoa === 'function'
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bytesToBase64Url(new Uint8Array(sig));
}

export async function signInstallCookieValue(): Promise<string> {
  const secret = getInstallCookieSigningSecret();
  if (!secret) {
    throw new Error('设置安装完成 Cookie 需要 INSTALL_COOKIE_SECRET 或 NEXTAUTH_SECRET');
  }
  const payload = `v1:${Math.floor(Date.now() / 1000)}`;
  const sig = await hmacSha256Base64Url(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyInstallCookieValue(value: string | undefined): Promise<boolean> {
  if (!value?.trim()) return false;
  if (value === '1') {
    return process.env.NODE_ENV !== 'production';
  }
  const secret = getInstallCookieSigningSecret();
  if (!secret) return false;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!payload.startsWith('v1:')) return false;
  const expected = await hmacSha256Base64Url(secret, payload);
  if (sig.length !== expected.length) return false;
  let ok = true;
  for (let i = 0; i < sig.length; i++) {
    if (sig.charCodeAt(i) !== expected.charCodeAt(i)) ok = false;
  }
  return ok;
}

export async function setSignedInstallCookie(res: NextResponse): Promise<void> {
  const value = await signInstallCookieValue();
  res.cookies.set(INSTALL_OK_COOKIE, value, {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}
