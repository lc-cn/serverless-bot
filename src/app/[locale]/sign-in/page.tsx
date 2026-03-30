import { setRequestLocale } from 'next-intl/server';
import { localizedRedirect } from '@/i18n/server-redirect';
import { auth } from '@/lib/auth';
import { SignInForm } from '@/components/auth/sign-in-up-form';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeSwitcher } from '@/components/layout/theme-switcher';

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user) {
    await localizedRedirect('/dashboard');
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="absolute right-3 top-3 z-10 flex flex-nowrap items-center gap-1 sm:right-4 sm:top-4 sm:gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
      <SignInForm />
    </div>
  );
}
