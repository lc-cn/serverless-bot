import { auth } from '@/lib/auth';
import { localizedRedirect } from '@/i18n/server-redirect';
import type { ExtendedSession } from '@/types/auth';
import { getSponsorPublicPayload } from '@/lib/sponsor-config';
import { OnboardingHub } from './onboarding-hub';

export default async function OnboardingPage() {
  const session = (await auth()) as ExtendedSession | null;
  if (!session?.user) {
    await localizedRedirect('/sign-in');
  }

  const sponsor = getSponsorPublicPayload();
  return <OnboardingHub sponsor={sponsor} />;
}
