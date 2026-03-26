import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/persistence';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { writeAuditLog } from '@/lib/audit';

export async function GET() {
  const { error, session } = await apiRequirePermission('agents:read');
  if (error) return error;
  const profiles = await storage.getLlmVendorProfilesByOwner(session!.user.id);
  return NextResponse.json({ profiles });
}

export async function POST(req: NextRequest) {
  const { error, session } = await apiRequirePermission('agents:manage');
  if (error) return error;
  try {
    const body = await req.json();
    const { vendorKind, name, apiBaseUrl, apiKey } = body;
    if (!vendorKind || !name || !apiBaseUrl) {
      return NextResponse.json(
        { error: 'vendorKind, name, apiBaseUrl are required' },
        { status: 400 }
      );
    }
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
    }
    const ex = body.extraJson;
    const profile = await storage.saveLlmVendorProfile(session!.user.id, {
      vendorKind: String(vendorKind),
      name: String(name),
      apiBaseUrl: String(apiBaseUrl),
      apiKey: String(apiKey),
      extraJson:
        ex !== undefined && ex !== null && String(ex).trim()
          ? String(ex).trim()
          : undefined,
    });
    void writeAuditLog({
      actorUserId: session!.user.id,
      action: 'llm_vendor_profile.create',
      entityType: 'llm_vendor_profile',
      entityId: profile.id,
      payload: { name: profile.name, vendorKind: profile.vendorKind },
      request: req,
    });
    return NextResponse.json({ profile });
  } catch (e) {
    console.error('[POST /api/llm/vendor-profiles]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create profile' },
      { status: 500 }
    );
  }
}
