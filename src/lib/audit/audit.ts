import type { NextRequest } from 'next/server';
import { db } from '@/lib/data-layer';
import { generateId } from '@/lib/shared/utils';

export type AuditWriteParams = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  request?: NextRequest | Request | null;
};

function clientMeta(request?: NextRequest | Request | null): { sourceIp: string | null; userAgent: string | null } {
  if (!request || !('headers' in request) || !request.headers) {
    return { sourceIp: null, userAgent: null };
  }
  const h = request.headers;
  const fwd = h.get('x-forwarded-for');
  const sourceIp = fwd?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  return { sourceIp, userAgent: h.get('user-agent') };
}

/** 异步最佳努力；失败只打 warn，不影响主事务 */
export async function writeAuditLog(p: AuditWriteParams): Promise<void> {
  try {
    const id = generateId();
    const now = new Date().toISOString();
    const { sourceIp, userAgent } = clientMeta(p.request);
    await db.execute(
      `INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, payload, source_ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        p.actorUserId,
        p.action,
        p.entityType,
        p.entityId ?? null,
        p.payload ? JSON.stringify(p.payload) : null,
        sourceIp,
        userAgent,
        now,
      ],
    );
  } catch (e) {
    console.warn('[audit] writeAuditLog failed', e);
  }
}

export type AuditRow = {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  sourceIp: string | null;
  userAgent: string | null;
  createdAt: string;
};

export async function listAuditLogs(params: {
  limit: number;
  offset: number;
  entityType?: string | null;
  actorUserId?: string | null;
}): Promise<AuditRow[]> {
  const lim = Math.min(Math.max(1, params.limit), 200);
  const off = Math.max(0, params.offset);
  const conditions: string[] = [];
  const args: unknown[] = [];
  if (params.entityType?.trim()) {
    conditions.push('entity_type = ?');
    args.push(params.entityType.trim());
  }
  if (params.actorUserId?.trim()) {
    conditions.push('actor_user_id = ?');
    args.push(params.actorUserId.trim());
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.query<{
    id: string;
    actor_user_id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    payload: string | null;
    source_ip: string | null;
    user_agent: string | null;
    created_at: string;
  }>(
    `SELECT id, actor_user_id, action, entity_type, entity_id, payload, source_ip, user_agent, created_at
     FROM audit_log ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...args, lim, off],
  );
  return rows.map((r) => ({
    id: r.id,
    actorUserId: r.actor_user_id,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    payload: r.payload ? safeJsonParse(r.payload) : null,
    sourceIp: r.source_ip,
    userAgent: r.user_agent,
    createdAt: r.created_at,
  }));
}

function safeJsonParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
}
