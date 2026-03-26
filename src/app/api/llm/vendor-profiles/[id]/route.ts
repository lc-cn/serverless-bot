import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:read');
  if (error) return error;
  const { id } = await params;
  const profile = await storage.getLlmVendorProfileForOwner(id, session!.user.id);
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  const { id } = await params;
  const existing = await storage.getLlmVendorProfileForOwner(id, session!.user.id);
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await req.json();
    const ex = body.extraJson;
    const profile = await storage.saveLlmVendorProfile(session!.user.id, {
      id,
      vendorKind:
        body.vendorKind !== undefined ? String(body.vendorKind) : existing.vendorKind,
      name: body.name !== undefined ? String(body.name) : existing.name,
      apiBaseUrl:
        body.apiBaseUrl !== undefined ? String(body.apiBaseUrl) : existing.apiBaseUrl,
      apiKey:
        body.apiKey !== undefined && String(body.apiKey).length > 0
          ? String(body.apiKey)
          : undefined,
      extraJson:
        ex !== undefined
          ? ex === null || String(ex).trim() === ''
            ? null
            : String(ex)
          : undefined,
    });
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_vendor_profile.update',
      entityType: 'llm_vendor_profile',
      entityId: id,
      payload: {
        name: profile.name,
        apiKeyRotated:
          body.apiKey !== undefined &&
          body.apiKey !== null &&
          String(body.apiKey).length > 0,
      },
      request: req,
    });
    return NextResponse.json({ profile });
  } catch (e) {
    console.error('[PUT /api/llm/vendor-profiles/[id]]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  const { id } = await params;
  const ok = await storage.deleteLlmVendorProfile(id, session!.user.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  void writeAuditLog({
    actorUserId: session!.user.id,
    action: 'llm_vendor_profile.delete',
    entityType: 'llm_vendor_profile',
    entityId: id,
    request: _req,
  });
  return NextResponse.json({ success: true });
}
