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
  const skill = await storage.getLlmSkillForOwner(id, session!.user.id);
  if (!skill) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ skill });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  const { id } = await params;
  const existing = await storage.getLlmSkillForOwner(id, session!.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (isPresetLibraryOwner(existing.ownerId)) {
    return NextResponse.json({ error: '预设技能为只读，请复制后再编辑' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { name, content, description } = body;
    const skill = await storage.saveLlmSkill(session!.user.id, {
      id,
      name: name !== undefined ? String(name) : existing.name,
      content: content !== undefined ? String(content) : existing.content,
      description: description !== undefined ? String(description) : existing.description,
    });
    return NextResponse.json({ skill });
  } catch (e) {
    console.error('[PUT /api/llm/skills/[id]]', e);
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
  const ok = await storage.deleteLlmSkill(id, session!.user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  void writeAuditLog({
    actorUserId: session!.user.id,
    action: 'llm_skill.delete',
    entityType: 'llm_skill',
    entityId: id,
    request: _req,
  });
  return NextResponse.json({ success: true });
}
