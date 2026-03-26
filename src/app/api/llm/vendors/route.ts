import { NextResponse } from 'next/server';
import { apiRequirePermission } from '@/lib/auth/permissions';
import { listLlmVendorKinds } from '@/llm/registry';

export async function GET() {
  const { error } = await apiRequirePermission('agents:read');
  if (error) return error;

  return NextResponse.json({ vendors: listLlmVendorKinds() });
}
