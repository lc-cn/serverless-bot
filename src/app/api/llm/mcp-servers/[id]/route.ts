import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

interface Params {
  params: Promise<{ id: string }>;
}

function normalizeHeadersJson(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    JSON.parse(t);
    return t;
  }
  return JSON.stringify(v);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:read');
  if (error) return error;
  const { id } = await params;
  const server = await storage.getLlmMcpServerWithHeadersForOwner(id, session!.user.id);
  if (!server) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ server });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  const { id } = await params;
  const existing = await storage.getLlmMcpServerForOwner(id, session!.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await req.json();
    let headersMerged: string | null | undefined;
    if ('headersJson' in body) {
      try {
        headersMerged = normalizeHeadersJson(body.headersJson);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON in headersJson' }, { status: 400 });
      }
    } else {
      headersMerged = undefined;
    }
    const server = await storage.saveLlmMcpServer(session!.user.id, {
      id,
      name: body.name !== undefined ? String(body.name) : existing.name,
      url: body.url !== undefined ? String(body.url) : existing.url,
      transport: body.transport !== undefined ? String(body.transport) : existing.transport,
      headersJson: headersMerged,
    });
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_mcp_server.update',
      entityType: 'llm_mcp_server',
      entityId: id,
      payload: { name: server.name, headersTouched: 'headersJson' in body },
      request: req,
    });
    return NextResponse.json({ server });
  } catch (e) {
    console.error('[PUT /api/llm/mcp-servers/[id]]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  const { id } = await params;
  const ok = await storage.deleteLlmMcpServer(id, session!.user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  void writeAuditLog({
    actorUserId: session!.user.id,
    action: 'llm_mcp_server.delete',
    entityType: 'llm_mcp_server',
    entityId: id,
    request: _req,
  });
  return NextResponse.json({ success: true });
}
