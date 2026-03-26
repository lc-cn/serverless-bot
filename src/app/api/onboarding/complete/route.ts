import { NextResponse } from 'next/server';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { storage } from '@/lib/persistence';

/** 标记新手引导已完成（当前用户仅可写自己） */
export async function POST() {
  const { error, session } = await apiRequireAuth();
  if (error) return error;

  const at = Date.now();
  await storage.updateUser(session!.user.id, { onboardingCompletedAt: at });

  return NextResponse.json({ ok: true, onboardingCompletedAt: at });
}
