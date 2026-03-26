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
  const model = await storage.getLlmVendorModelForOwner(id, session!.user.id);
  if (!model) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ model });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  const { id } = await params;
  const existing = await storage.getLlmVendorModelForOwner(id, session!.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await req.json();
    let extraMerged: string | null;
    try {
      extraMerged = 'extraJson' in body ? normalizeJsonField(body.extraJson) : existing.extraJson ?? null;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in extraJson' }, { status: 400 });
    }
    const model = await storage.saveLlmVendorModel(session!.user.id, {
      id,
      profileId:
        body.profileId !== undefined ? String(body.profileId) : existing.profileId,
      modelId: body.modelId !== undefined ? String(body.modelId) : existing.modelId,
      displayName:
        body.displayName !== undefined
          ? body.displayName === '' || body.displayName == null
            ? undefined
            : String(body.displayName)
          : existing.displayName,
      extraJson: extraMerged,
    });
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_vendor_model.update',
      entityType: 'llm_vendor_model',
      entityId: id,
      payload: { modelId: model.modelId },
      request: req,
    });
    return NextResponse.json({ model });
  } catch (e) {
    console.error('[PUT /api/llm/vendor-models/[id]]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update model' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  const { id } = await params;
  const ok = await storage.deleteLlmVendorModel(id, session!.user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  void writeAuditLog({
    actorUserId: session!.user.id,
    action: 'llm_vendor_model.delete',
    entityType: 'llm_vendor_model',
    entityId: id,
    request: _req,
  });
  return NextResponse.json({ success: true });
}
