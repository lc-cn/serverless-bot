import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const PREFIX = 'agk1:'; // versioned payload
const LEGACY_PLAIN = 'plain1:';

function getKeyBytes(): Buffer | null {
  const raw = process.env.AGENTS_ENCRYPTION_KEY?.trim();
  if (raw) {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    try {
      const b = Buffer.from(raw, 'base64');
      if (b.length === 32) return b;
    } catch {
      /* ignore */
    }
    return scryptSync(raw, 'llm-agents-salt', 32);
  }
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (secret) {
    return scryptSync(secret, 'llm-agents-fallback', 32);
  }
  return null;
}

/**
 * 加密 Agent API Key；若无可用密钥则使用 LEGACY_PLAIN（开发环境），并打警告
 */
export function encryptAgentApiKey(plain: string): string {
  const key = getKeyBytes();
  if (!key) {
    console.warn(
      '[agent-key-crypto] No AGENTS_ENCRYPTION_KEY or NEXTAUTH_SECRET; storing API key with plain prefix (not for production)'
    );
    return LEGACY_PLAIN + Buffer.from(plain, 'utf8').toString('base64url');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptAgentApiKey(stored: string): string {
  if (stored.startsWith(LEGACY_PLAIN)) {
    return Buffer.from(stored.slice(LEGACY_PLAIN.length), 'base64url').toString('utf8');
  }
  if (!stored.startsWith(PREFIX)) {
    throw new Error('Unrecognized agent key format');
  }
  const key = getKeyBytes();
  if (!key) {
    throw new Error('Cannot decrypt agent API key: configure AGENTS_ENCRYPTION_KEY or NEXTAUTH_SECRET');
  }
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64url');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
