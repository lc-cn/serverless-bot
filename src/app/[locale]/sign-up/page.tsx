import { setRequestLocale } from 'next-intl/server';
import { localizedRedirect } from '@/i18n/server-redirect';
import { auth, getAuthSettings } from '@/lib/auth';
import { SignUpForm } from '@/components/auth/sign-in-up-form';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, settings] = await Promise.all([auth(), getAuthSettings()]);
  if (session?.user) {
    await localizedRedirect('/dashboard');
  }
  if (!settings.registrationEnabled) {
    await localizedRedirect('/sign-in');
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
      <SignUpForm />
    </div>
  );
}
