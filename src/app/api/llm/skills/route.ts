import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const { error, session } = await apiRequirePermission('agents:read');
  if (error) return error;
  const skills = await storage.getLlmSkillsByOwner(session!.user.id);
  return NextResponse.json({ skills });
}

export async function POST(req: NextRequest) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  try {
    const body = await req.json();
    const { name, content, description } = body;
    if (!name || !content) {
      return NextResponse.json({ error: 'name and content are required' }, { status: 400 });
    }
    const skill = await storage.saveLlmSkill(session!.user.id, {
      name: String(name),
      content: String(content),
      description: description != null ? String(description) : undefined,
    });
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_skill.create',
      entityType: 'llm_skill',
      entityId: skill.id,
      payload: { name: skill.name },
      request: req,
    });
    return NextResponse.json({ skill });
  } catch (e) {
    console.error('[POST /api/llm/skills]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create skill' },
      { status: 500 }
    );
  }
}
