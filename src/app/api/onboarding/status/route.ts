import { NextResponse } from 'next/server';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { storage } from '@/lib/persistence';
import { computeOnboardingChecklist } from '@/lib/onboarding/onboarding-checklist';

export async function GET() {
  const { error, session } = await apiRequireAuth();
  if (error) return error;

  const userId = session!.user.id;
  const user = await storage.getUser(userId);
  const checklist = await computeOnboardingChecklist(userId);

  return NextResponse.json({
    onboardingCompletedAt: user?.onboardingCompletedAt ?? null,
    checklist,
  });
}
