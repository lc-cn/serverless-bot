import { localizedRedirect } from '@/i18n/server-redirect';
import { auth } from '@/lib/auth';
import { storage } from '@/lib/persistence';
import { shouldRedirectToOnboarding } from '@/lib/onboarding/onboarding-gate';
import type { ExtendedSession } from '@/types/auth';
import { DashboardAppShell } from '@/components/layout/dashboard-app-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = (await auth()) as ExtendedSession | null;
  if (!session?.user) {
    await localizedRedirect('/sign-in');
  }

  const dbUser = await storage.getUser(session!.user!.id);
  // 仅枢纽毕业门禁；分板块 onboarding_sections_json 不拦截子路由
  if (shouldRedirectToOnboarding(dbUser, session!.user!.permissions || [])) {
    await localizedRedirect('/onboarding');
  }

  const u = session!.user!;

  return (
    <DashboardAppShell
      user={{
        name: u.name?.trim() || u.email || 'User',
        email: u.email ?? undefined,
        image: u.image ?? null,
      }}
    >
      {children}
    </DashboardAppShell>
  );
}
