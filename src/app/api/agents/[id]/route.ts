import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

interface Params {
  params: Promise<{ id: string }>;
}

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

export async function GET(_req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:read');
  if (error) return error;

  const { id } = await params;
  const agent = await storage.getLlmAgentForOwner(id, session!.user.id);
  if (!agent) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ agent });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;

  const { id } = await params;
  const existing = await storage.getLlmAgentForOwner(id, session!.user.id);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = await req.json();

    let extraMerged: string | null;
    try {
      if ('extraJson' in body) extraMerged = normalizeJsonField(body.extraJson);
      else extraMerged = existing.extraJson ?? null;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in extra' }, { status: 400 });
    }

    const presetMerged =
      'presetSystemPrompt' in body
        ? body.presetSystemPrompt == null || body.presetSystemPrompt === ''
          ? undefined
          : String(body.presetSystemPrompt)
        : existing.presetSystemPrompt;

    let nextConfigured: string;
    if ('configuredModelId' in body) {
      const raw = body.configuredModelId;
      nextConfigured =
        raw != null && String(raw).trim() !== '' ? String(raw).trim() : '';
    } else {
      nextConfigured =
        existing.configuredModelId != null && String(existing.configuredModelId).trim() !== ''
          ? String(existing.configuredModelId).trim()
          : '';
    }
    if (!nextConfigured) {
      return NextResponse.json({ error: 'configuredModelId is required' }, { status: 400 });
    }

    const agent = await storage.saveLlmAgent(session!.user.id, {
      id,
      name: body.name !== undefined ? String(body.name) : existing.name,
      configuredModelId: nextConfigured,
      presetSystemPrompt: presetMerged,
      extraJson: extraMerged,
      ...('skillIds' in body
        ? { skillIds: Array.isArray(body.skillIds) ? body.skillIds.map(String) : [] }
        : {}),
      ...('toolIds' in body
        ? { toolIds: Array.isArray(body.toolIds) ? body.toolIds.map(String) : [] }
        : {}),
      ...('mcpServerIds' in body
        ? { mcpServerIds: Array.isArray(body.mcpServerIds) ? body.mcpServerIds.map(String) : [] }
        : {}),
    });

    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_agent.update',
      entityType: 'llm_agent',
      entityId: id,
      payload: {
        name: agent.name,
        configuredModelId: agent.configuredModelId ?? undefined,
      },
      request: req,
    });

    return NextResponse.json({ agent });
  } catch (e) {
    console.error('[PUT /api/agents/[id]]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update agent' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;

  const { id } = await params;
  const ok = await storage.deleteLlmAgent(id, session!.user.id);
  if (!ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  void writeAuditLog({
    actorUserId: session!.user.id,
    action: 'llm_agent.delete',
    entityType: 'llm_agent',
    entityId: id,
    request: _req,
  });
  return NextResponse.json({ success: true });
}
