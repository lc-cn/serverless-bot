import { kv } from '@vercel/kv';
import { createClient, type Client } from '@libsql/client';

export type PeerType = 'group' | 'contact';

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot' | 'system';
  text: string;
  timestamp: number;
  peerId?: string;
  peerType?: PeerType;
}

export interface ContactRecord {
  id: string;
  name: string;
  role?: string;
}

export interface GroupRecord {
  id: string;
  name: string;
}

export interface ChatStore {
  appendMessage(params: {
    platform: string;
    botId: string;
    peerType?: PeerType | null;
    peerId?: string | null;
    message: ChatMessage;
    cap: number;
  }): Promise<void>;
  listMessages(params: {
    platform: string;
    botId: string;
    peerType?: PeerType | null;
    peerId?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<ChatMessage[]>;
  upsertContact(params: { platform: string; botId: string; contact: ContactRecord; groupId?: string }): Promise<void>;
  listContacts(params: { platform: string; botId: string; groupId?: string }): Promise<ContactRecord[]>;
  deleteContact(params: { platform: string; botId: string; id: string; groupId?: string }): Promise<void>;
  upsertGroup(params: { platform: string; botId: string; group: GroupRecord }): Promise<void>;
  listGroups(params: { platform: string; botId: string }): Promise<GroupRecord[]>;
  deleteGroup(params: { platform: string; botId: string; id: string }): Promise<void>;
}

function kvMessageKey(platform: string, botId: string, peerType?: PeerType | null, peerId?: string | null) {
  if (peerId && peerType) return `chat:messages:${platform}:${botId}:${peerType}:${peerId}`;
  return `chat:messages:${platform}:${botId}`;
}

function kvContactsKey(platform: string, botId: string, groupId?: string) {
  return groupId
    ? `chat:contacts:${platform}:${botId}:group:${groupId}`
    : `chat:contacts:${platform}:${botId}`;
}

function kvGroupsKey(platform: string, botId: string) {
  return `chat:groups:${platform}:${botId}`;
}

class KvChatStore implements ChatStore {
  async appendMessage({ platform, botId, peerType, peerId, message, cap }: Parameters<ChatStore['appendMessage']>[0]) {
    const key = kvMessageKey(platform, botId, peerType ?? undefined, peerId ?? undefined);
    await kv.rpush(key, message);
    await kv.ltrim(key, -cap, -1);
  }

  async listMessages({ platform, botId, peerType, peerId, limit, offset }: Parameters<ChatStore['listMessages']>[0]) {
    const key = kvMessageKey(platform, botId, peerType ?? undefined, peerId ?? undefined);
    const start = offset ?? 0;
    const end = limit ? start + limit - 1 : -1;
    const messages = (await kv.lrange<ChatMessage>(key, start, end)) || [];
    return messages;
  }

  async upsertContact({ platform, botId, contact, groupId }: Parameters<ChatStore['upsertContact']>[0]) {
    const key = kvContactsKey(platform, botId, groupId);
    const list = (await kv.get<ContactRecord[]>(key)) || [];
    const next = list.filter((c) => c.id !== contact.id).concat(contact);
    await kv.set(key, next, { ex: 60 * 30 });
  }

  async listContacts({ platform, botId, groupId }: Parameters<ChatStore['listContacts']>[0]) {
    const key = kvContactsKey(platform, botId, groupId);
    return (await kv.get<ContactRecord[]>(key)) || [];
  }

  async upsertGroup({ platform, botId, group }: Parameters<ChatStore['upsertGroup']>[0]) {
    const key = kvGroupsKey(platform, botId);
    const list = (await kv.get<GroupRecord[]>(key)) || [];
    const next = list.filter((g) => g.id !== group.id).concat(group);
    await kv.set(key, next, { ex: 60 * 30 });
  }

  async listGroups({ platform, botId }: Parameters<ChatStore['listGroups']>[0]) {
    const key = kvGroupsKey(platform, botId);
    return (await kv.get<GroupRecord[]>(key)) || [];
  }

  async deleteContact({ platform, botId, id, groupId }: Parameters<ChatStore['deleteContact']>[0]) {
    const key = kvContactsKey(platform, botId, groupId);
    const list = (await kv.get<ContactRecord[]>(key)) || [];
    const next = list.filter((c) => c.id !== id);
    await kv.set(key, next, { ex: 60 * 30 });
  }

  async deleteGroup({ platform, botId, id }: Parameters<ChatStore['deleteGroup']>[0]) {
    const key = kvGroupsKey(platform, botId);
    const list = (await kv.get<GroupRecord[]>(key)) || [];
    const next = list.filter((g) => g.id !== id);
    await kv.set(key, next, { ex: 60 * 30 });
  }
}

// Turso / libSQL store (no ORM)
let _db: Client | null = null;
async function getDb(): Promise<Client | null> {
  const url = process.env.LIBSQL_URL || process.env.TURSO_DATABASE_URL;
  if (!url) return null;
  if (_db) return _db;
  _db = createClient({ url, authToken: process.env.LIBSQL_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN });
  return _db;
}

class SqlChatStore implements ChatStore {
  async appendMessage({ platform, botId, peerType, peerId, message, cap }: Parameters<ChatStore['appendMessage']>[0]) {
    const db = await getDb();
    if (!db) throw new Error('LIBSQL_URL not configured');
    const pt = peerType ?? 'contact';
    const pid = peerId ?? '';
    await db.execute({
      sql: `INSERT INTO messages (id, platform, bot_id, peer_id, peer_type, role, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO NOTHING`,
      args: [message.id, platform, botId, pid, pt, message.role, message.text],
    });
    await db.execute({
      sql: `DELETE FROM messages
            WHERE rowid IN (
              SELECT rowid FROM messages
              WHERE platform = ? AND bot_id = ? AND peer_type = ? AND peer_id = ?
              ORDER BY created_at DESC
              LIMIT -1 OFFSET ?
            )`,
      args: [platform, botId, pt, pid, cap],
    });
  }

  async listMessages({ platform, botId, peerType, peerId, limit = 200, offset = 0 }: Parameters<ChatStore['listMessages']>[0]) {
    const db = await getDb();
    if (!db) throw new Error('LIBSQL_URL not configured');
    const pt = peerType ?? 'contact';
    const pid = peerId ?? '';
    const res = await db.execute({
      sql: `SELECT id, role, content as text, created_at as timestamp, peer_id as peerId, peer_type as peerType
            FROM messages
            WHERE platform = ? AND bot_id = ? AND peer_type = ? AND peer_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
      args: [platform, botId, pt, pid, limit, offset],
    });
    return (res.rows as any[]).map((r) => ({
      id: String((r as any).id),
      role: (r as any).role,
      text: (r as any).text,
      timestamp: new Date((r as any).timestamp).getTime(),
      peerId: (r as any).peerId || undefined,
      peerType: (r as any).peerType || undefined,
    })) as ChatMessage[];
  }

  async upsertContact({ platform, botId, contact, groupId }: Parameters<ChatStore['upsertContact']>[0]) {
    const db = await getDb();
    if (!db) throw new Error('LIBSQL_URL not configured');
    await db.execute({
      sql: `INSERT INTO contacts (peer_id, platform, bot_id, name, role, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(peer_id, platform, bot_id)
            DO UPDATE SET name=excluded.name, role=excluded.role, updated_at=datetime('now')`,
      args: [contact.id, platform, botId, contact.name, contact.role || null],
    });
  }

  async listContacts({ platform, botId, groupId }: Parameters<ChatStore['listContacts']>[0]) {
    const db = await getDb();
    if (!db) throw new Error('LIBSQL_URL not configured');
    const res = await db.execute({
      sql: `SELECT peer_id as id, name, role FROM contacts
            WHERE platform = ? AND bot_id = ?
            ORDER BY updated_at DESC`,
      args: [platform, botId],
    });
    return res.rows.map((r: any) => ({ id: r.id, name: r.name, role: r.role })) as ContactRecord[];
  }

  async deleteContact({ platform, botId, id, groupId }: Parameters<ChatStore['deleteContact']>[0]) {
    const db = await getDb();
    if (!db) throw new Error('LIBSQL_URL not configured');
    await db.execute({
      sql: `DELETE FROM contacts WHERE peer_id = ? AND platform = ? AND bot_id = ?`,
      args: [id, platform, botId],
    });
  }

  async upsertGroup({ platform, botId, group }: Parameters<ChatStore['upsertGroup']>[0]) {
    const db = await getDb();
    if (!db) throw new Error('LIBSQL_URL not configured');
    await db.execute({
      sql: `INSERT INTO groups (group_id, platform, bot_id, name, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(group_id, platform, bot_id)
            DO UPDATE SET name=excluded.name, updated_at=datetime('now')`,
      args: [group.id, platform, botId, group.name],
    });
  }

  async listGroups({ platform, botId }: Parameters<ChatStore['listGroups']>[0]) {
    const db = await getDb();
    if (!db) throw new Error('LIBSQL_URL not configured');
    const res = await db.execute({
      sql: `SELECT group_id as id, name FROM groups
            WHERE platform = ? AND bot_id = ?
            ORDER BY updated_at DESC`,
      args: [platform, botId],
    });
    return res.rows.map((r: any) => ({ id: r.id, name: r.name })) as GroupRecord[];
  }

  async deleteGroup({ platform, botId, id }: Parameters<ChatStore['deleteGroup']>[0]) {
    const db = await getDb();
    if (!db) throw new Error('LIBSQL_URL not configured');
    await db.execute({
      sql: `DELETE FROM groups WHERE group_id = ? AND platform = ? AND bot_id = ?`,
      args: [id, platform, botId],
    });
  }
}

class HybridChatStore implements ChatStore {
  private kvStore = new KvChatStore();
  private sqlStore: SqlChatStore | null = null;
  private async ensureSql() {
    if (this.sqlStore) return this.sqlStore;
    const db = await getDb();
    if (!db) return null;
    this.sqlStore = new SqlChatStore();
    return this.sqlStore;
  }

  async appendMessage(args: Parameters<ChatStore['appendMessage']>[0]) {
    const sql = await this.ensureSql();
    if (sql) {
      try { await sql.appendMessage(args); } catch (e) { console.warn('[HybridChatStore] sql append failed', e); }
    }
    await this.kvStore.appendMessage(args);
  }

  async listMessages(args: Parameters<ChatStore['listMessages']>[0]) {
    const sql = await this.ensureSql();
    if (sql) {
      try { return await sql.listMessages(args); } catch (e) { console.warn('[HybridChatStore] sql list failed', e); }
    }
    return this.kvStore.listMessages(args);
  }

  async upsertContact(args: Parameters<ChatStore['upsertContact']>[0]) {
    const sql = await this.ensureSql();
    if (sql) { try { await sql.upsertContact(args); } catch (e) { console.warn('[HybridChatStore] sql upsertContact failed', e); } }
    await this.kvStore.upsertContact(args);
  }

  async listContacts(args: Parameters<ChatStore['listContacts']>[0]) {
    const sql = await this.ensureSql();
    if (sql) {
      try { return await sql.listContacts(args); } catch (e) { console.warn('[HybridChatStore] sql listContacts failed', e); }
    }
    return this.kvStore.listContacts(args);
  }

  async upsertGroup(args: Parameters<ChatStore['upsertGroup']>[0]) {
    const sql = await this.ensureSql();
    if (sql) { try { await sql.upsertGroup(args); } catch (e) { console.warn('[HybridChatStore] sql upsertGroup failed', e); } }
    await this.kvStore.upsertGroup(args);
  }

  async listGroups(args: Parameters<ChatStore['listGroups']>[0]) {
    const sql = await this.ensureSql();
    if (sql) {
      try { return await sql.listGroups(args); } catch (e) { console.warn('[HybridChatStore] sql listGroups failed', e); }
    }
    return this.kvStore.listGroups(args);
  }

  async deleteContact(args: Parameters<ChatStore['deleteContact']>[0]) {
    const sql = await this.ensureSql();
    if (sql) { try { await sql.deleteContact(args); } catch (e) { console.warn('[HybridChatStore] sql deleteContact failed', e); } }
    await this.kvStore.deleteContact(args);
  }

  async deleteGroup(args: Parameters<ChatStore['deleteGroup']>[0]) {
    const sql = await this.ensureSql();
    if (sql) { try { await sql.deleteGroup(args); } catch (e) { console.warn('[HybridChatStore] sql deleteGroup failed', e); } }
    await this.kvStore.deleteGroup(args);
  }
}

let _store: ChatStore | null = null;
export function getChatStore(): ChatStore {
  if (_store) return _store;
  _store = new HybridChatStore();
  return _store;
}
