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
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
      <SignInForm />
    </div>
  );
}
