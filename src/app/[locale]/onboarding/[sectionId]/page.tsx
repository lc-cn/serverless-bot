import { auth } from '@/lib/auth';
import { localizedRedirect } from '@/i18n/server-redirect';
import { notFound } from 'next/navigation';
import type { ExtendedSession } from '@/types/auth';
import { ONBOARDING_SECTION_IDS, type OnboardingSectionId } from '@/lib/onboarding/onboarding-registry';
import { OnboardingSectionClient } from '../section-client';

function isOnboardingSectionId(s: string): s is OnboardingSectionId {
  return (ONBOARDING_SECTION_IDS as readonly string[]).includes(s);
}

export default async function OnboardingSectionPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = await params;
  if (!isOnboardingSectionId(sectionId)) {
    notFound();
  }

  const session = (await auth()) as ExtendedSession | null;
  if (!session?.user) {
    await localizedRedirect('/sign-in');
  }

  return (
    <OnboardingSectionClient
      sectionId={sectionId}
      permissions={session!.user.permissions || []}
    />
  );
}
