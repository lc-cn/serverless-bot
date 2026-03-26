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

export async function GET(request: NextRequest) {
  const { error, session } = await apiRequirePermission('agents:read');
  if (error) return error;
  const profileId = request.nextUrl.searchParams.get('profileId');
  const models = profileId
    ? await storage.getLlmVendorModelsByProfile(profileId, session!.user.id)
    : await storage.getLlmVendorModelsByOwner(session!.user.id);
  return NextResponse.json({ models });
}

export async function POST(req: NextRequest) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  try {
    const body = await req.json();
    const { profileId, modelId, displayName } = body;
    if (!profileId || !modelId) {
      return NextResponse.json(
        { error: 'profileId and modelId are required' },
        { status: 400 }
      );
    }
    let extraJson: string | null;
    try {
      extraJson = normalizeJsonField(body.extraJson);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in extraJson' }, { status: 400 });
    }
    const model = await storage.saveLlmVendorModel(session!.user.id, {
      profileId: String(profileId),
      modelId: String(modelId),
      displayName: displayName != null ? String(displayName) : undefined,
      extraJson,
    });
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_vendor_model.create',
      entityType: 'llm_vendor_model',
      entityId: model.id,
      payload: { modelId: model.modelId, profileId: model.profileId },
      request: req,
    });
    return NextResponse.json({ model });
  } catch (e) {
    console.error('[POST /api/llm/vendor-models]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create model' },
      { status: 500 }
    );
  }
}
