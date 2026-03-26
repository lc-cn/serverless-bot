import { setRequestLocale } from 'next-intl/server';
import { localizedRedirect } from '@/i18n/server-redirect';
import { auth, getAuthSettings } from '@/lib/auth';
import { HomeLanding } from '@/components/marketing/home-landing';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, authSettings] = await Promise.all([auth(), getAuthSettings()]);
  if (session?.user) {
    await localizedRedirect('/dashboard');
  }

  const registrationEnabled = authSettings.registrationEnabled;

  return <HomeLanding signedIn={false} registrationEnabled={registrationEnabled} />;
}
