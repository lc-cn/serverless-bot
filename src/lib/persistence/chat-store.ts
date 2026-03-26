import { db, getKvRedis, isRelationalDatabaseConfigured } from '@/lib/data-layer';
import { getSqlDialect } from '@/lib/database/sql-dialect';
import { getPlatformSettings } from '@/lib/platform-settings';

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
  private kv() {
    return getKvRedis();
  }

  async appendMessage({ platform, botId, peerType, peerId, message, cap }: Parameters<ChatStore['appendMessage']>[0]) {
    const key = kvMessageKey(platform, botId, peerType ?? undefined, peerId ?? undefined);
    const kv = this.kv();
    await kv.rpush(key, message);
    await kv.ltrim(key, -cap, -1);
  }

  async listMessages({ platform, botId, peerType, peerId, limit, offset }: Parameters<ChatStore['listMessages']>[0]) {
    const key = kvMessageKey(platform, botId, peerType ?? undefined, peerId ?? undefined);
    const start = offset ?? 0;
    const end = limit ? start + limit - 1 : -1;
    const messages = (await this.kv().lrange<ChatMessage>(key, start, end)) || [];
    return messages;
  }

  async upsertContact({ platform, botId, contact, groupId }: Parameters<ChatStore['upsertContact']>[0]) {
    const key = kvContactsKey(platform, botId, groupId);
    const kv = this.kv();
    const list = (await kv.get<ContactRecord[]>(key)) || [];
    const next = list.filter((c) => c.id !== contact.id).concat(contact);
    await kv.set(key, next, { ex: 60 * 30 });
  }

  async listContacts({ platform, botId, groupId }: Parameters<ChatStore['listContacts']>[0]) {
    const key = kvContactsKey(platform, botId, groupId);
    return (await this.kv().get<ContactRecord[]>(key)) || [];
  }

  async upsertGroup({ platform, botId, group }: Parameters<ChatStore['upsertGroup']>[0]) {
    const key = kvGroupsKey(platform, botId);
    const kv = this.kv();
    const list = (await kv.get<GroupRecord[]>(key)) || [];
    const next = list.filter((g) => g.id !== group.id).concat(group);
    await kv.set(key, next, { ex: 60 * 30 });
  }

  async listGroups({ platform, botId }: Parameters<ChatStore['listGroups']>[0]) {
    const key = kvGroupsKey(platform, botId);
    return (await this.kv().get<GroupRecord[]>(key)) || [];
  }

  async deleteContact({ platform, botId, id, groupId }: Parameters<ChatStore['deleteContact']>[0]) {
    const key = kvContactsKey(platform, botId, groupId);
    const kv = this.kv();
    const list = (await kv.get<ContactRecord[]>(key)) || [];
    const next = list.filter((c) => c.id !== id);
    await kv.set(key, next, { ex: 60 * 30 });
  }

  async deleteGroup({ platform, botId, id }: Parameters<ChatStore['deleteGroup']>[0]) {
    const key = kvGroupsKey(platform, botId);
    const kv = this.kv();
    const list = (await kv.get<GroupRecord[]>(key)) || [];
    const next = list.filter((g) => g.id !== id);
    await kv.set(key, next, { ex: 60 * 30 });
  }
}

/** 关系库（libSQL / node:sqlite / MySQL）上的聊天持久化，经统一 DbClient */
class SqlChatStore implements ChatStore {
  async appendMessage({ platform, botId, peerType, peerId, message, cap }: Parameters<ChatStore['appendMessage']>[0]) {
    const pt = peerType ?? 'contact';
    const pid = peerId ?? '';
    const now = new Date().toISOString();
    if (getSqlDialect() === 'mysql') {
      await db.execute(
        `INSERT IGNORE INTO messages (id, platform, bot_id, peer_id, peer_type, role, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [message.id, platform, botId, pid, pt, message.role, message.text, now]
      );
      await db.execute(
        `DELETE FROM messages WHERE id IN (
           SELECT id FROM (
             SELECT id FROM messages
             WHERE platform = ? AND bot_id = ? AND peer_type = ? AND peer_id = ?
             ORDER BY created_at DESC
             LIMIT 4294967295 OFFSET ?
           ) _trim
         )`,
        [platform, botId, pt, pid, cap]
      );
    } else {
      await db.execute(
        `INSERT INTO messages (id, platform, bot_id, peer_id, peer_type, role, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [message.id, platform, botId, pid, pt, message.role, message.text, now]
      );
      await db.execute(
        `DELETE FROM messages
         WHERE rowid IN (
           SELECT rowid FROM messages
           WHERE platform = ? AND bot_id = ? AND peer_type = ? AND peer_id = ?
           ORDER BY created_at DESC
           LIMIT -1 OFFSET ?
         )`,
        [platform, botId, pt, pid, cap]
      );
    }
  }

  async listMessages({ platform, botId, peerType, peerId, limit = 200, offset = 0 }: Parameters<ChatStore['listMessages']>[0]) {
    const pt = peerType ?? 'contact';
    const pid = peerId ?? '';
    const rows = await db.query<any>(
      `SELECT id, role, content as text, created_at as timestamp, peer_id as peerId, peer_type as peerType
       FROM messages
       WHERE platform = ? AND bot_id = ? AND peer_type = ? AND peer_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [platform, botId, pt, pid, limit, offset]
    );
    return rows.map((r: any) => ({
      id: String(r.id),
      role: r.role,
      text: r.text,
      timestamp: new Date(r.timestamp).getTime(),
      peerId: r.peerId || undefined,
      peerType: r.peerType || undefined,
    })) as ChatMessage[];
  }

  async upsertContact({ platform, botId, contact }: Parameters<ChatStore['upsertContact']>[0]) {
    const now = new Date().toISOString();
    if (getSqlDialect() === 'mysql') {
      await db.execute(
        `INSERT INTO contacts (peer_id, platform, bot_id, name, role, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), updated_at = VALUES(updated_at)`,
        [contact.id, platform, botId, contact.name, contact.role || null, now]
      );
    } else {
      await db.execute(
        `INSERT INTO contacts (peer_id, platform, bot_id, name, role, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(peer_id, platform, bot_id)
         DO UPDATE SET name = excluded.name, role = excluded.role, updated_at = excluded.updated_at`,
        [contact.id, platform, botId, contact.name, contact.role || null, now]
      );
    }
  }

  async listContacts({ platform, botId }: Parameters<ChatStore['listContacts']>[0]) {
    const rows = await db.query<any>(
      `SELECT peer_id as id, name, role FROM contacts
       WHERE platform = ? AND bot_id = ?
       ORDER BY updated_at DESC`,
      [platform, botId]
    );
    return rows.map((r: any) => ({ id: r.id, name: r.name, role: r.role })) as ContactRecord[];
  }

  async deleteContact({ platform, botId, id }: Parameters<ChatStore['deleteContact']>[0]) {
    await db.execute(`DELETE FROM contacts WHERE peer_id = ? AND platform = ? AND bot_id = ?`, [
      id,
      platform,
      botId,
    ]);
  }

  async upsertGroup({ platform, botId, group }: Parameters<ChatStore['upsertGroup']>[0]) {
    const now = new Date().toISOString();
    if (getSqlDialect() === 'mysql') {
      await db.execute(
        `INSERT INTO \`groups\` (group_id, platform, bot_id, name, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = VALUES(updated_at)`,
        [group.id, platform, botId, group.name, now]
      );
    } else {
      await db.execute(
        `INSERT INTO groups (group_id, platform, bot_id, name, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(group_id, platform, bot_id)
         DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
        [group.id, platform, botId, group.name, now]
      );
    }
  }

  async listGroups({ platform, botId }: Parameters<ChatStore['listGroups']>[0]) {
    const rows = await db.query<any>(
      `SELECT group_id as id, name FROM \`groups\`
       WHERE platform = ? AND bot_id = ?
       ORDER BY updated_at DESC`,
      [platform, botId]
    );
    return rows.map((r: any) => ({ id: r.id, name: r.name })) as GroupRecord[];
  }

  async deleteGroup({ platform, botId, id }: Parameters<ChatStore['deleteGroup']>[0]) {
    await db.execute(`DELETE FROM \`groups\` WHERE group_id = ? AND platform = ? AND bot_id = ?`, [
      id,
      platform,
      botId,
    ]);
  }
}

function logHybridChatSqlFailure(op: string, err: unknown, meta: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn(
    JSON.stringify({
      event: 'hybrid_chat_sql_failure',
      op,
      error: message,
      ...meta,
    }),
  );
}

class HybridChatStore implements ChatStore {
  private kvStore = new KvChatStore();
  private sqlStore: SqlChatStore | null = null;

  private async sqlRequired(): Promise<boolean> {
    return (await getPlatformSettings()).chatSqlRequired;
  }

  private async ensureSql() {
    if (this.sqlStore) return this.sqlStore;
    if (!isRelationalDatabaseConfigured()) return null;
    this.sqlStore = new SqlChatStore();
    return this.sqlStore;
  }

  async appendMessage(args: Parameters<ChatStore['appendMessage']>[0]) {
    const sqlReq = await this.sqlRequired();
    const sql = await this.ensureSql();
    let sqlWriteOk = !sql;
    if (sql) {
      try {
        await sql.appendMessage(args);
        sqlWriteOk = true;
      } catch (e) {
        logHybridChatSqlFailure('appendMessage', e, { platform: args.platform, botId: args.botId });
        if (sqlReq) throw e;
      }
    }
    if (!sqlReq || sqlWriteOk) {
      await this.kvStore.appendMessage(args);
    }
  }

  async listMessages(args: Parameters<ChatStore['listMessages']>[0]) {
    const sql = await this.ensureSql();
    if (sql) {
      try {
        return await sql.listMessages(args);
      } catch (e) {
        logHybridChatSqlFailure('listMessages', e, { platform: args.platform, botId: args.botId });
      }
    }
    return this.kvStore.listMessages(args);
  }

  async upsertContact(args: Parameters<ChatStore['upsertContact']>[0]) {
    const sqlReq = await this.sqlRequired();
    const sql = await this.ensureSql();
    let sqlWriteOk = !sql;
    if (sql) {
      try {
        await sql.upsertContact(args);
        sqlWriteOk = true;
      } catch (e) {
        logHybridChatSqlFailure('upsertContact', e, { platform: args.platform, botId: args.botId });
        if (sqlReq) throw e;
      }
    }
    if (!sqlReq || sqlWriteOk) {
      await this.kvStore.upsertContact(args);
    }
  }

  async listContacts(args: Parameters<ChatStore['listContacts']>[0]) {
    const sql = await this.ensureSql();
    if (sql) {
      try {
        return await sql.listContacts(args);
      } catch (e) {
        logHybridChatSqlFailure('listContacts', e, { platform: args.platform, botId: args.botId });
      }
    }
    return this.kvStore.listContacts(args);
  }

  async upsertGroup(args: Parameters<ChatStore['upsertGroup']>[0]) {
    const sqlReq = await this.sqlRequired();
    const sql = await this.ensureSql();
    let sqlWriteOk = !sql;
    if (sql) {
      try {
        await sql.upsertGroup(args);
        sqlWriteOk = true;
      } catch (e) {
        logHybridChatSqlFailure('upsertGroup', e, { platform: args.platform, botId: args.botId });
        if (sqlReq) throw e;
      }
    }
    if (!sqlReq || sqlWriteOk) {
      await this.kvStore.upsertGroup(args);
    }
  }

  async listGroups(args: Parameters<ChatStore['listGroups']>[0]) {
    const sql = await this.ensureSql();
    if (sql) {
      try {
        return await sql.listGroups(args);
      } catch (e) {
        logHybridChatSqlFailure('listGroups', e, { platform: args.platform, botId: args.botId });
      }
    }
    return this.kvStore.listGroups(args);
  }

  async deleteContact(args: Parameters<ChatStore['deleteContact']>[0]) {
    const sqlReq = await this.sqlRequired();
    const sql = await this.ensureSql();
    let sqlWriteOk = !sql;
    if (sql) {
      try {
        await sql.deleteContact(args);
        sqlWriteOk = true;
      } catch (e) {
        logHybridChatSqlFailure('deleteContact', e, { platform: args.platform, botId: args.botId });
        if (sqlReq) throw e;
      }
    }
    if (!sqlReq || sqlWriteOk) {
      await this.kvStore.deleteContact(args);
    }
  }

  async deleteGroup(args: Parameters<ChatStore['deleteGroup']>[0]) {
    const sqlReq = await this.sqlRequired();
    const sql = await this.ensureSql();
    let sqlWriteOk = !sql;
    if (sql) {
      try {
        await sql.deleteGroup(args);
        sqlWriteOk = true;
      } catch (e) {
        logHybridChatSqlFailure('deleteGroup', e, { platform: args.platform, botId: args.botId });
        if (sqlReq) throw e;
      }
    }
    if (!sqlReq || sqlWriteOk) {
      await this.kvStore.deleteGroup(args);
    }
  }
}

let _store: ChatStore | null = null;
export function getChatStore(): ChatStore {
  if (_store) return _store;
  _store = new HybridChatStore();
  return _store;
}
