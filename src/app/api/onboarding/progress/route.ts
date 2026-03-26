import { NextRequest, NextResponse } from 'next/server';
import { apiRequireAuth } from '@/lib/auth/permissions';
import { storage } from '@/lib/persistence';
import {
  ONBOARDING_SECTIONS,
  type OnboardingSectionId,
  userCanAccessOnboardingSection,
} from '@/lib/onboarding/onboarding-registry';
import {
  applySectionAction,
  resolveOnboardingSectionsState,
  serializeOnboardingSectionsState,
} from '@/lib/onboarding/onboarding-sections';
import { computeOnboardingChecklist } from '@/lib/onboarding/onboarding-checklist';

function isSectionId(s: string): s is OnboardingSectionId {
  return ONBOARDING_SECTIONS.some((x) => x.id === s);
}

export async function GET() {
  const { error, session } = await apiRequireAuth();
  if (error) return error;

  const userId = session!.user.id;
  const user = await storage.getUser(userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const sectionsState = resolveOnboardingSectionsState(
    user.onboardingSectionsJson,
    user.onboardingCompletedAt,
  );
  const permissions = session!.user.permissions || [];
  const checklist = await computeOnboardingChecklist(userId);

  const registry = ONBOARDING_SECTIONS.map((def) => ({
    ...def,
    canAccess: userCanAccessOnboardingSection(def, permissions),
    progress: sectionsState[def.id] ?? { status: 'pending' as const },
  }));

  return NextResponse.json({
    hubCompletedAt: user.onboardingCompletedAt ?? null,
    sections: sectionsState,
    registry,
    hints: checklist,
  });
}

export async function PATCH(req: NextRequest) {
  const { error, session } = await apiRequireAuth();
  if (error) return error;

  let body: { sectionId?: string; action?: string };
  try {
    body = (await req.json()) as { sectionId?: string; action?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sectionId = body.sectionId != null ? String(body.sectionId).trim() : '';
  const action = body.action === 'skip' ? 'skip' : body.action === 'complete' ? 'complete' : null;
  if (!sectionId || !isSectionId(sectionId)) {
    return NextResponse.json({ error: 'Invalid sectionId' }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ error: 'action must be complete or skip' }, { status: 400 });
  }

  const userId = session!.user.id;
  const user = await storage.getUser(userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const def = ONBOARDING_SECTIONS.find((s) => s.id === sectionId)!;
  if (!userCanAccessOnboardingSection(def, session!.user.permissions || [])) {
    return NextResponse.json({ error: 'Forbidden for this section' }, { status: 403 });
  }

  const base = resolveOnboardingSectionsState(
    user.onboardingSectionsJson,
    user.onboardingCompletedAt,
  );
  const next = applySectionAction(base, sectionId, action);
  const json = serializeOnboardingSectionsState(next);
  await storage.updateUser(userId, { onboardingSectionsJson: json });

  const fresh = await storage.getUser(userId);
  const sectionsState = resolveOnboardingSectionsState(
    fresh?.onboardingSectionsJson,
    fresh?.onboardingCompletedAt,
  );

  return NextResponse.json({
    ok: true,
    sections: sectionsState,
  });
}
