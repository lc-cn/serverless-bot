import { NextRequest, NextResponse } from 'next/server';
import { listAuditLogs } from '@/lib/audit';
import { apiRequirePermission } from '@/lib/auth/permissions';

/**
 * 审计日志列表（需 audit:read）。query: limit, offset, entityType, actorUserId
 */
export async function GET(request: NextRequest) {
  const { error, session } = await apiRequirePermission('audit:read');
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const rawLimit = Number(sp.get('limit') ?? '50');
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
  const rawOff = Number(sp.get('offset') ?? '0');
  const offset = Number.isFinite(rawOff) ? rawOff : 0;
  const entityType = sp.get('entityType');
  const actorUserId = sp.get('actorUserId');

  try {
    const items = await listAuditLogs({
      limit,
      offset,
      entityType: entityType || null,
      actorUserId: actorUserId || null,
    });
    return NextResponse.json({
      items,
      viewerId: session!.user.id,
    });
  } catch (e) {
    console.error('[audit] list failed', e);
    return NextResponse.json({ error: 'Failed to list audit log' }, { status: 500 });
  }
}
