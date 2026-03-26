import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';
import { isPresetLibraryOwner } from '@/lib/preset-library';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:read');
  if (error) return error;
  const { id } = await params;
  const tool = await storage.getLlmToolForOwner(id, session!.user.id);
  if (!tool) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ tool });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  const { id } = await params;
  const existing = await storage.getLlmToolForOwner(id, session!.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (isPresetLibraryOwner(existing.ownerId)) {
    return NextResponse.json({ error: '预设工具为只读，请复制后再编辑' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { name, definitionJson, description, steps } = body;
    let def = existing.definitionJson;
    if (definitionJson !== undefined) {
      def =
        typeof definitionJson === 'string' ? definitionJson : JSON.stringify(definitionJson);
    }
    const tool = await storage.saveLlmTool(session!.user.id, {
      id,
      name: name !== undefined ? String(name) : existing.name,
      definitionJson: def,
      description: description !== undefined ? String(description) : existing.description,
      steps: Array.isArray(steps) ? steps : undefined,
    });
    return NextResponse.json({ tool });
  } catch (e) {
    console.error('[PUT /api/llm/tools/[id]]', e);
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
  const ok = await storage.deleteLlmTool(id, session!.user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  void writeAuditLog({
    actorUserId: session!.user.id,
    action: 'llm_tool.delete',
    entityType: 'llm_tool',
    entityId: id,
    request: _req,
  });
  return NextResponse.json({ success: true });
}
