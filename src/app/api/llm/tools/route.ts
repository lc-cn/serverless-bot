import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const { error, session } = await apiRequirePermission('agents:read');
  if (error) return error;
  const tools = await storage.getLlmToolsByOwner(session!.user.id);
  return NextResponse.json({ tools });
}

export async function POST(req: NextRequest) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  try {
    const body = await req.json();
    const { name, definitionJson, description, steps } = body;
    if (!name || !definitionJson) {
      return NextResponse.json({ error: 'name and definitionJson are required' }, { status: 400 });
    }
    const tool = await storage.saveLlmTool(session!.user.id, {
      name: String(name),
      definitionJson:
        typeof definitionJson === 'string' ? definitionJson : JSON.stringify(definitionJson),
      description: description != null ? String(description) : undefined,
      steps: Array.isArray(steps) ? steps : [],
    });
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_tool.create',
      entityType: 'llm_tool',
      entityId: tool.id,
      payload: { name: tool.name },
      request: req,
    });
    return NextResponse.json({ tool });
  } catch (e) {
    console.error('[POST /api/llm/tools]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create tool' },
      { status: 500 }
    );
  }
}
