import { db } from '@/lib/data-layer';
import { generateId } from '@/lib/shared/utils';

export async function saveChallenge(
  challenge: string,
  userId: string | null,
  expiresAt: Date,
): Promise<void> {
  await db.execute(
    `INSERT INTO webauthn_challenges (challenge, user_id, expires_at) VALUES (?, ?, ?)`,
    [challenge, userId, expiresAt.toISOString()],
  );
}

export async function takeChallenge(challenge: string): Promise<{ userId: string | null } | null> {
  const row = await db.queryOne<{ user_id: string | null }>(
    'SELECT user_id FROM webauthn_challenges WHERE challenge = ?',
    [challenge],
  );
  if (!row) return null;
  await db.execute('DELETE FROM webauthn_challenges WHERE challenge = ?', [challenge]);
  return { userId: row.user_id };
}

export async function purgeExpiredChallenges(): Promise<void> {
  const now = new Date().toISOString();
  await db.execute('DELETE FROM webauthn_challenges WHERE expires_at < ?', [now]);
}

export type StoredCredential = {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceName?: string;
  createdAt?: string;
};

export async function listCredentialsForUser(userId: string): Promise<StoredCredential[]> {
  const rows = await db.query<{
    id: string;
    user_id: string;
    credential_id: string;
    public_key: string;
    counter: number;
    transports: string | null;
    device_name: string | null;
    created_at: string;
  }>('SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at', [userId]);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    credentialId: r.credential_id,
    publicKey: r.public_key,
    counter: Number(r.counter),
    transports: r.transports ? (JSON.parse(r.transports) as string[]) : undefined,
    deviceName: r.device_name ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function getCredentialByCredentialId(
  credentialId: string,
): Promise<StoredCredential | null> {
  const row = await db.queryOne<{
    id: string;
    user_id: string;
    credential_id: string;
    public_key: string;
    counter: number;
    transports: string | null;
    device_name: string | null;
  }>('SELECT * FROM webauthn_credentials WHERE credential_id = ?', [credentialId]);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    credentialId: row.credential_id,
    publicKey: row.public_key,
    counter: Number(row.counter),
    transports: row.transports ? (JSON.parse(row.transports) as string[]) : undefined,
    deviceName: row.device_name ?? undefined,
  };
}

export async function insertCredential(params: {
  userId: string;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: string[];
  deviceName?: string;
}): Promise<void> {
  const id = generateId();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO webauthn_credentials (id, user_id, credential_id, public_key, counter, transports, device_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.userId,
      params.credentialId,
      Buffer.from(params.publicKey).toString('base64url'),
      params.counter,
      params.transports ? JSON.stringify(params.transports) : null,
      params.deviceName ?? null,
      now,
    ],
  );
}

export async function updateCredentialCounter(credentialDbId: string, counter: number): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(
    'UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE id = ?',
    [counter, now, credentialDbId],
  );
}

export async function deleteCredentialForUser(credentialDbId: string, userId: string): Promise<boolean> {
  const r = await db.execute('DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?', [
    credentialDbId,
    userId,
  ]);
  return r.changes > 0;
}
