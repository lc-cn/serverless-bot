import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

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

export async function GET() {
  const { error, session } = await apiRequirePermission('agents:read');
  if (error) return error;
  const servers = await storage.getLlmMcpServersByOwner(session!.user.id);
  return NextResponse.json({ servers });
}

export async function POST(req: NextRequest) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  try {
    const body = await req.json();
    const { name, url, transport } = body;
    if (!name || !url) {
      return NextResponse.json({ error: 'name and url are required' }, { status: 400 });
    }
    let headersJson: string | null;
    try {
      headersJson = normalizeHeadersJson(body.headersJson);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in headersJson' }, { status: 400 });
    }
    const server = await storage.saveLlmMcpServer(session!.user.id, {
      name: String(name),
      url: String(url),
      transport: transport != null ? String(transport) : undefined,
      headersJson,
    });
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_mcp_server.create',
      entityType: 'llm_mcp_server',
      entityId: server.id,
      payload: { name: server.name },
      request: req,
    });
    return NextResponse.json({ server });
  } catch (e) {
    console.error('[POST /api/llm/mcp-servers]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create MCP server' },
      { status: 500 }
    );
  }
}
