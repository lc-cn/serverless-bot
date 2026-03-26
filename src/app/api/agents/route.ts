import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

function normalizeJsonField(v: unknown): string | null {
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

  const agents = await storage.getLlmAgentsByOwner(session!.user.id);
  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;

  try {
    const body = await req.json();
    const { name, presetSystemPrompt, extraJson, configuredModelId } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const cfgId =
      configuredModelId != null && String(configuredModelId).trim() !== ''
        ? String(configuredModelId).trim()
        : null;
    if (!cfgId) {
      return NextResponse.json(
        { error: 'configuredModelId is required（请先在「模型连接」添加预置模型）' },
        { status: 400 }
      );
    }

    let extra: string | null = null;
    try {
      extra = normalizeJsonField(extraJson);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in extra' }, { status: 400 });
    }

    const skillIds = Array.isArray(body.skillIds) ? body.skillIds.map(String) : [];
    const toolIds = Array.isArray(body.toolIds) ? body.toolIds.map(String) : [];
    const mcpServerIds = Array.isArray(body.mcpServerIds) ? body.mcpServerIds.map(String) : [];

    const agent = await storage.saveLlmAgent(session!.user.id, {
      name: String(name),
      configuredModelId: cfgId,
      presetSystemPrompt: presetSystemPrompt ? String(presetSystemPrompt) : undefined,
      extraJson: extra,
      skillIds,
      toolIds,
      mcpServerIds,
    });

    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_agent.create',
      entityType: 'llm_agent',
      entityId: agent.id,
      payload: {
        name: agent.name,
        vendorKind: agent.vendorKind,
        configuredModelId: agent.configuredModelId ?? undefined,
      },
      request: req,
    });

    return NextResponse.json({ agent });
  } catch (e) {
    console.error('[POST /api/agents]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create agent' },
      { status: 500 }
    );
  }
}
